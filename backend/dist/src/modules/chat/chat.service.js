"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
var ChatService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.ChatService = void 0;
const common_1 = require("@nestjs/common");
const prisma_service_1 = require("../../prisma/prisma.service");
const crypto = require("crypto");
let ChatService = ChatService_1 = class ChatService {
    constructor(prisma) {
        this.prisma = prisma;
        this.logger = new common_1.Logger(ChatService_1.name);
        this.algorithm = 'aes-256-gcm';
        this.secretKey = process.env.ENCRYPTION_KEY || '12345678901234567890123456789012';
    }
    encrypt(text) {
        const iv = crypto.randomBytes(16);
        const cipher = crypto.createCipheriv(this.algorithm, Buffer.from(this.secretKey), iv);
        let encrypted = cipher.update(text, 'utf8', 'hex');
        encrypted += cipher.final('hex');
        const authTag = cipher.getAuthTag().toString('hex');
        return {
            encryptedText: encrypted,
            iv: iv.toString('hex'),
            authTag: authTag,
        };
    }
    decrypt(encryptedText, iv, authTag) {
        try {
            const decipher = crypto.createDecipheriv(this.algorithm, Buffer.from(this.secretKey), Buffer.from(iv, 'hex'));
            decipher.setAuthTag(Buffer.from(authTag, 'hex'));
            let decrypted = decipher.update(encryptedText, 'hex', 'utf8');
            decrypted += decipher.final('utf8');
            return decrypted;
        }
        catch (error) {
            this.logger.error(`Decryption failed: ${error.message}`);
            return '[Message content corrupted or decryption key invalid]';
        }
    }
    async sendMessage(senderId, receiverId, content) {
        const { encryptedText, iv, authTag } = this.encrypt(content);
        const packedContent = `${encryptedText}:${iv}:${authTag}`;
        return this.prisma.message.create({
            data: {
                senderId,
                receiverId,
                content: packedContent,
            },
        });
    }
    async getAdminAllChats() {
        const rawMessages = await this.prisma.message.findMany({
            orderBy: { sentAt: 'desc' },
            take: 200,
        });
        return rawMessages.map(msg => {
            let decryptedContent = msg.content;
            if (msg.content.includes(':') && msg.content.split(':').length === 3) {
                const [encrypted, iv, authTag] = msg.content.split(':');
                decryptedContent = this.decrypt(encrypted, iv, authTag);
            }
            return { ...msg, content: decryptedContent };
        });
    }
};
exports.ChatService = ChatService;
exports.ChatService = ChatService = ChatService_1 = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService])
], ChatService);
//# sourceMappingURL=chat.service.js.map