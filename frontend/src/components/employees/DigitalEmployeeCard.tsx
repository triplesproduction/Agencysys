'use client';

import { useState } from 'react';
import { X, QrCode, Download, Printer, RefreshCw } from 'lucide-react';
import { EmployeeDTO } from '@/types/dto';
import './DigitalEmployeeCard.css';

export default function DigitalEmployeeCard({ employee, onClose }: { employee: EmployeeDTO, onClose: () => void }) {
    const [isFlipped, setIsFlipped] = useState(false);

    return (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.85)', backdropFilter: 'blur(8px)', zIndex: 200, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>

            <div style={{ width: '100%', maxWidth: '800px', display: 'flex', justifyContent: 'space-between', marginBottom: '24px' }}>
                <h2 style={{ color: 'white', margin: 0 }}>Digital Identity Card</h2>
                <button onClick={onClose} style={{ background: 'transparent', border: 'none', color: 'white', cursor: 'pointer' }}>
                    <X size={24} />
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
                            <QrCode size={48} className="qr-code" />
                            <div className="validity-auth">
                                <div><span className="meta-label">VALID THRU</span> <span style={{ fontWeight: 'bold' }}>12/2030</span></div>
                                <div className="auth-sig">AUTHORIZED SIGNATURE</div>
                            </div>
                        </div>
                    </div>

                    {/* BACK OF CARD */}
                    <div className="id-card-back">
                        <div style={{ background: 'black', height: '40px', width: '100%', marginTop: '20px' }}></div>

                        <div className="back-content">
                            <h4 style={{ margin: '0 0 16px', color: 'var(--purple-main)' }}>EMERGENCY CONTACT & MEDICAL</h4>
                            <div className="meta-grid-back" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                                <div>
                                    <span className="meta-label">CONTACT NAME / PHONE</span>
                                    <span className="meta-value" style={{ color: 'white' }}>{employee.emergencyContact || 'Not Provided'}</span>
                                </div>
                                <div>
                                    <span className="meta-label">BLOOD GROUP</span>
                                    <span className="meta-value" style={{ color: 'white' }}>{'O+ (Mock)'}</span>
                                </div>
                            </div>

                            <div style={{ background: 'white', height: '40px', width: '80%', margin: '24px 0', border: '1px solid #ccc' }}>
                                <span style={{ color: '#000', fontSize: '10px', padding: '4px' }}>Authorizing Digital Signature...</span>
                            </div>

                            <div style={{ fontSize: '0.65rem', color: '#888', textAlign: 'justify', lineHeight: '1.4' }}>
                                This physical/digital card remains the property of TripleS OS. If found, please return to the Human Resources department or contact headquarters at +1 (800) 555-0199. Unauthorized duplication or alteration of this credential is a violation of company policy.
                            </div>

                            <div style={{ textAlign: 'center', marginTop: '24px' }}>
                                <QrCode size={64} style={{ opacity: 0.8 }} />
                                <div style={{ fontSize: '0.65rem', marginTop: '8px', letterSpacing: '2px' }}>VERIFY-AUTH-CODE: {employee.id}</div>
                            </div>
                        </div>
                    </div>

                </div>
            </div>

            {/* Action Bar */}
            <div style={{ display: 'flex', gap: '16px', marginTop: '32px' }}>
                <button className="primary-button hoverable" onClick={() => setIsFlipped(!isFlipped)} style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <RefreshCw size={16} /> Flip Card
                </button>
                <button className="secondary-button hoverable" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <Download size={16} /> Export PDF
                </button>
                <button className="secondary-button hoverable" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <Printer size={16} /> Print ISO
                </button>
            </div>

        </div>
    );
}
