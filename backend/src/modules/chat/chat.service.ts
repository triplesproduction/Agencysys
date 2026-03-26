import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { NotificationService } from '../notification/notification.service';
import * as crypto from 'crypto';

@Injectable()
export class ChatService {
  private readonly logger = new Logger(ChatService.name);
  private readonly algorithm = 'aes-256-gcm';
  private get encryptionKey(): Buffer {
    let key = process.env.ENCRYPTION_KEY || '12345678901234567890123456789012';
    // Ensure key is exactly 32 bytes for aes-256-gcm
    if (key.length < 32) key = key.padEnd(32, '0');
    return Buffer.from(key.substring(0, 32));
  }

  constructor(
    private prisma: PrismaService,
    private notificationService: NotificationService
  ) { }

  encrypt(text: string): { encryptedText: string; iv: string; authTag: string } {
    try {
      const iv = crypto.randomBytes(12);
      const cipher = crypto.createCipheriv(this.algorithm, this.encryptionKey, iv);
      let encrypted = cipher.update(text, 'utf8', 'hex');
      encrypted += cipher.final('hex');
      const authTag = cipher.getAuthTag().toString('hex');
      return {
        encryptedText: encrypted,
        iv: iv.toString('hex'),
        authTag: authTag,
      };
    } catch (err) {
      this.logger.error(`Encryption failed for text of length ${text?.length}: ${err.message}`);
      // Fallback: use hex-compatible zeros
      return {
        encryptedText: Buffer.from(text || '', 'utf8').toString('hex'),
        iv: '000000000000000000000000', // 12 bytes = 24 chars
        authTag: '00000000000000000000000000000000' // 16 bytes = 32 chars
      };
    }
  }

  decrypt(encryptedText: string, iv: string, authTag: string): string {
    if (!encryptedText || !iv || !authTag || iv.startsWith('000000')) {
      try {
        if (encryptedText && /^[0-9a-fA-F]+$/.test(encryptedText) && encryptedText.length % 2 === 0) {
          return Buffer.from(encryptedText, 'hex').toString('utf8');
        }
      } catch { }
      return encryptedText || '';
    }

    try {
      // Validate hex strings before Buffer conversion to avoid RangeError/Invalid string length
      const isHex = (h: string) => /^[0-9a-fA-F]+$/.test(h);
      if (!isHex(encryptedText) || !isHex(iv) || !isHex(authTag)) {
        return '[Corrupted Hex Data]';
      }

      // Buffer.from with 'hex' requires even length
      const safeIvStr = iv.length % 2 === 0 ? iv : iv.substring(0, iv.length - 1);
      const safeTagStr = authTag.length % 2 === 0 ? authTag : authTag.substring(0, authTag.length - 1);
      const safeEncStr = encryptedText.length % 2 === 0 ? encryptedText : encryptedText.substring(0, encryptedText.length - 1);

      const ivBuf = Buffer.from(safeIvStr, 'hex');
      const tagBuf = Buffer.from(safeTagStr, 'hex');
      const encBuf = Buffer.from(safeEncStr, 'hex');

      // GCM requires specific lengths, usually 12 byte IV and 16 byte tag
      if (ivBuf.length !== 12 || tagBuf.length !== 16) {
        this.logger.warn(`Skipping decryption: invalid IV(${ivBuf.length}) or Tag(${tagBuf.length}) length`);
        return '[Legacy or Corrupted Encryption Format]';
      }

      const decipher = crypto.createDecipheriv(this.algorithm, this.encryptionKey, ivBuf);
      decipher.setAuthTag(tagBuf);
      let decrypted = decipher.update(encBuf).toString('utf8');
      decrypted += decipher.final('utf8');
      return decrypted;
    } catch (error) {
      this.logger.error(`Decryption error for [${encryptedText}:${iv}:${authTag}]: ${error.stack || error.message}`);
      return '[Message decryption failed]';
    }
  }

  async sendMessage(senderId: string, receiverId: string, content: string) {
    const trimmedContent = (content || '').trim();
    if (!trimmedContent) throw new Error('Message content is empty.');
    if (!senderId) throw new Error('Sender ID is missing.');

    const { encryptedText, iv, authTag } = this.encrypt(trimmedContent);
    const packedContent = `${encryptedText}:${iv}:${authTag}`;

    const message = await this.prisma.message.create({
      data: {
        senderId,
        receiverId: (receiverId && receiverId !== 'null' && receiverId !== 'undefined' && receiverId !== 'ALL') ? receiverId : null,
        content: packedContent,
        attachments: [],
      },
    });

    // ── TRIGGER NOTIFICATION (Non-blocking) ──
    (async () => {
      try {
        if (receiverId && receiverId !== 'GLOBAL' && receiverId !== 'null' && receiverId !== 'undefined') {
          // Safety: If receiverId isn't a likely UUID/Standard ID, skip to avoid DB errors
          const recipient = await this.prisma.employee.findUnique({
            where: { id: receiverId }
          }).catch(() => null);

          if (!recipient) {
            this.logger.debug(`Skipping notification: recipient ${receiverId} not found.`);
            return;
          }

          const sender = await this.prisma.employee.findUnique({
            where: { id: senderId },
            select: { firstName: true, lastName: true }
          }).catch(() => null);

          const senderName = sender ? `${sender.firstName} ${sender.lastName}` : 'Someone';

          await this.notificationService.createNotification({
            recipientId: receiverId,
            title: `New Message from ${senderName}`,
            message: content.length > 50 ? content.substring(0, 47) + '...' : content,
            type: 'CHAT_MESSAGE',
            metadata: {
              messageId: message.id,
              senderId: senderId,
              senderName: senderName
            }
          });
        }
      } catch (err) {
        this.logger.error(`Notification dispatch error: ${err.message}`);
      }
    })();

    return message;
  }

  async getAdminAllChats() {
    try {
      const rawMessages = await this.prisma.message.findMany({
        orderBy: { sentAt: 'desc' },
        take: 200,
      });

      const participantIds = new Set<string>();
      rawMessages.forEach(m => {
        if (m.senderId) participantIds.add(String(m.senderId));
        if (m.receiverId && m.receiverId !== 'GLOBAL') participantIds.add(String(m.receiverId));
      });

      const participantMap = new Map<string, any>();
      try {
        const participants = await this.prisma.employee.findMany({
          where: { id: { in: Array.from(participantIds) } },
          select: { id: true, firstName: true, lastName: true, profilePhoto: true }
        });
        participants.forEach(p => participantMap.set(p.id, p));
      } catch (err) {
        this.logger.warn(`Participant detail fetch failed: ${err.message}`);
      }

      return rawMessages.map(msg => {
        let decryptedContent = msg.content;
        try {
          if (msg.content && msg.content.includes(':') && msg.content.split(':').length === 3) {
            const [encrypted, iv, authTag] = msg.content.split(':');
            decryptedContent = this.decrypt(encrypted, iv, authTag);
          }
        } catch (deerr) {
          this.logger.error(`Decryption error during admin map for msg ${msg.id}: ${deerr.message}`);
          decryptedContent = '[Message Decryption Failed]';
        }

        return {
          ...msg,
          content: decryptedContent,
          sender: participantMap.get(msg.senderId) || (msg.senderId === 'SYSTEM' ? { firstName: 'System', lastName: '' } : null),
          receiver: (msg.receiverId && msg.receiverId !== 'GLOBAL') ? participantMap.get(msg.receiverId) : null
        };
      });
    } catch (finalError) {
      this.logger.error(`getAdminAllChats fatal error: ${finalError.message}`);
      return [];
    }
  }

  async getMyChats(userId: string) {
    try {
      const rawMessages = await this.prisma.message.findMany({
        where: {
          OR: [
            { senderId: userId },
            { receiverId: userId },
            { receiverId: 'GLOBAL' }
          ]
        },
        orderBy: { sentAt: 'asc' },
        take: 500,
      });

      const participantIds = new Set<string>();
      rawMessages.forEach(m => {
        if (m.senderId) participantIds.add(String(m.senderId));
        if (m.receiverId && m.receiverId !== 'GLOBAL') participantIds.add(String(m.receiverId));
      });

      const participantMap = new Map<string, any>();
      try {
        const participants = await this.prisma.employee.findMany({
          where: { id: { in: Array.from(participantIds) } },
          select: { id: true, firstName: true, lastName: true, profilePhoto: true }
        });
        participants.forEach(p => participantMap.set(p.id, p));
      } catch (err) {
        this.logger.warn(`MyChats Participant detail fetch failed: ${err.message}`);
      }

      return rawMessages.map(msg => {
        let decryptedContent = msg.content;
        try {
          if (msg.content && msg.content.includes(':') && msg.content.split(':').length === 3) {
            const [encrypted, iv, authTag] = msg.content.split(':');
            decryptedContent = this.decrypt(encrypted, iv, authTag);
          }
        } catch (deerr) {
          this.logger.error(`Decryption error during map for msg ${msg.id}: ${deerr.message}`);
          decryptedContent = '[Message Decryption Failed]';
        }

        return {
          ...msg,
          content: decryptedContent,
          sender: participantMap.get(msg.senderId) || (msg.senderId === 'SYSTEM' ? { firstName: 'System', lastName: '' } : null),
          receiver: (msg.receiverId && msg.receiverId !== 'GLOBAL') ? participantMap.get(msg.receiverId) : null
        };
      });
    } catch (finalError) {
      this.logger.error(`getMyChats fatal error for user ${userId}: ${finalError.message}`);
      return []; // Return empty list on fatal error so the app doesn't crash
    }
  }

  async deleteMessage(messageId: string, userId: string, forEveryone: boolean) {
    this.logger.log(`Attempting to delete message ${messageId} by user ${userId} (forEveryone: ${forEveryone})`);

    const message = await this.prisma.message.findUnique({
      where: { id: messageId }
    });

    if (!message) {
      this.logger.warn(`Message ${messageId} not found during deletion attempt`);
      throw new Error('Message not found');
    }

    this.logger.log(`Message found. Sender: ${message.senderId}, Requester: ${userId}`);

    // Only sender can delete for everyone
    if (forEveryone && String(message.senderId) !== String(userId)) {
      this.logger.warn(`User ${userId} attempted to delete message ${messageId} for everyone but is not the sender (${message.senderId})`);
      throw new Error('Only the sender can delete this message for everyone');
    }

    // For now, in Phase 1, both "delete" and "delete for everyone" will hard delete
    try {
      return await this.prisma.message.delete({
        where: { id: messageId }
      });
    } catch (error) {
      this.logger.error(`Prisma delete failed for message ${messageId}: ${error.message}`);
      throw error;
    }
  }
}
