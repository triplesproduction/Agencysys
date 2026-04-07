'use client';

import { useState } from 'react';
import { X, QrCode, Download, Printer, RefreshCw } from 'lucide-react';
import { EmployeeDTO } from '@/types/dto';
import './DigitalEmployeeCard.css';

export default function DigitalEmployeeCard({ employee, onClose }: { employee: EmployeeDTO, onClose: () => void }) {
    const [isFlipped, setIsFlipped] = useState(false);

    return (
        <div className="id-card-overlay">
            <div className="id-card-modal">
                <div className="id-card-modal-header">
                    <div className="header-badge">OFFICIAL DOCUMENT</div>
                    <h2 className="modal-title">Digital Identity Card</h2>
                    <button onClick={onClose} className="close-button">
                        <X size={20} />
                    </button>
                </div>

            {/* Interactive Card Container */}
            <div className={`id-card-container ${isFlipped ? 'flipped' : ''}`} onClick={() => setIsFlipped(!isFlipped)}>
                <div className="id-card-inner">

                    {/* FRONT OF CARD */}
                    <div className="id-card-front">
                        <div className="id-header">
                            <h3 className="agency-logo">TripleS OS</h3>
                            <div className="agency-brand">AGENCY PERSONNEL</div>
                        </div>

                        <div className="id-body">
                            <div className="photo-section">
                                <div className="photo-frame">
                                    {employee.profilePhoto ? (
                                        <img src={employee.profilePhoto} alt="Profile" />
                                    ) : (
                                        <div className="photo-placeholder">{employee.firstName.charAt(0)}</div>
                                    )}
                                </div>
                            </div>

                            <div className="details-section">
                                <h2 className="emp-name">{employee.firstName} {employee.lastName}</h2>
                                <div className="emp-role">{employee.roleId.replace(/_/g, ' ')}</div>

                                <div className="emp-meta-grid">
                                    <div>
                                        <span className="meta-label">ID NUMBER</span>
                                        <span className="meta-value">{employee.id}</span>
                                    </div>
                                    <div>
                                        <span className="meta-label">DEPARTMENT</span>
                                        <span className="meta-value">{employee.department || 'Operations'}</span>
                                    </div>
                                    <div>
                                        <span className="meta-label">JOINED</span>
                                        <span className="meta-value">{new Date(employee.joinedAt).toLocaleDateString()}</span>
                                    </div>
                                    <div>
                                        <span className="meta-label">LOCATION</span>
                                        <span className="meta-value">{employee.workLocation || 'OFFICE'}</span>
                                    </div>
                                </div>
                            </div>
                        </div>

                        <div className="id-footer">
                            <QrCode size={42} className="qr-code" />
                            <div className="validity-auth">
                                <div className="expiration-badge">
                                    <span className="meta-label">VALID THRU</span>
                                    <span className="meta-value" style={{ fontWeight: '800', color: 'white' }}>12/2030</span>
                                </div>
                                <div className="signature-container">
                                    <div className="auth-signature">TripleS Admin</div>
                                    <div className="auth-sig-label">authorized signature</div>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* BACK OF CARD */}
                    <div className="id-card-back">
                        <div className="id-header back-header-recto">
                            <h3 className="agency-logo">TripleS OS</h3>
                            <div className="agency-brand">AGENCY PERSONNEL</div>
                        </div>

                        <div className="back-content">
                            <h4 style={{ margin: '0 0 16px', color: 'var(--purple-main)', fontSize: '11px', fontWeight: 'bold' }}>EMERGENCY CONTACT & MEDICAL</h4>
                            <div className="meta-grid-back" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                                <div>
                                    <span className="meta-label">CONTACT NAME / PHONE</span>
                                    <span className="meta-value" style={{ color: 'white' }}>{employee.emergencyContact || '+91 8956183973'}</span>
                                </div>
                                <div>
                                    <span className="meta-label">BLOOD GROUP</span>
                                    <span className="meta-value" style={{ color: 'white' }}>{'O+'}</span>
                                </div>
                            </div>

                            <div className="digital-sig-strip">
                                <span className="sig-label">Authorizing Digital Signature...</span>
                            </div>

                            <div className="disclaimer-text">
                                This ID remains property of TripleS OS. If found, please return to HR or contact +91 8956183973. Unauthorized use is prohibited.
                            </div>

                            <div className="back-footer">
                                <QrCode size={48} style={{ opacity: 0.6 }} />
                                <div className="auth-code">REF: {employee.id.substring(0, 8).toUpperCase()}</div>
                            </div>
                        </div>
                    </div>

                </div>
            </div>

            {/* Action Bar */}
            <div className="id-card-actions">
                <button className="id-action-btn flip" onClick={(e) => { e.stopPropagation(); setIsFlipped(!isFlipped); }}>
                    <RefreshCw size={16} /> <span>Flip Card</span>
                </button>
                <div className="action-divider"></div>
                <button className="id-action-btn secondary" onClick={(e) => { e.stopPropagation(); window.print(); }}>
                    <Download size={16} /> <span>Export as PDF</span>
                </button>
            </div>

            </div>
        </div>
    );
}
