import React, { useState, useRef } from 'react';
import { X, User, Briefcase, Key, FileText, Plus, Save, Download, Trash2, Eye, ChevronRight, ChevronLeft, CheckCircle, Copy } from 'lucide-react';
import { api } from '../../lib/api';

interface UploadedDocument {
    id: string;
    name: string;
    fileType: string;
    content: string; // Base64
}

const CreateEmployeeModal = ({ isOpen, onClose, addNotification }: any) => {
    const [step, setStep] = useState(1);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [provisioningStatus, setProvisioningStatus] = useState('');
    const [documents, setDocuments] = useState<UploadedDocument[]>([]);
    const [createdCredentials, setCreatedCredentials] = useState<{ email: string; tempPassword: string } | null>(null);
    const [copiedEmail, setCopiedEmail] = useState(false);
    const [copiedPassword, setCopiedPassword] = useState(false);
    const fileInputRef = useRef<HTMLInputElement>(null);

    const [formData, setFormData] = useState({
        firstName: '',
        lastName: '',
        email: '',
        personalEmail: '',
        dob: '',
        gender: 'MALE',
        phone: '',
        address: '',
        emergencyContact: '',
        department: '',
        designation: '',
        joinedAt: '',
        workLocation: 'OFFICE',
        roleId: 'EMPLOYEE',
        status: 'ACTIVE'
    });

    const [phoneError, setPhoneError] = useState('');

    if (!isOpen) return null;

    const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
        setFormData(prev => ({ ...prev, [e.target.name]: e.target.value }));
    };

    const handlePhoneChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const val = e.target.value.replace(/\D/g, '').slice(0, 10);
        setFormData(prev => ({ ...prev, phone: val }));
        if (val && val.length !== 10) {
            setPhoneError('Phone number must be exactly 10 digits');
        } else {
            setPhoneError('');
        }
    };

    const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        if (file.size > 5 * 1024 * 1024) {
            alert('File size must be less than 5MB');
            return;
        }

        const reader = new FileReader();
        reader.onload = (event) => {
            const newDoc: UploadedDocument = {
                id: Math.random().toString(36).substr(2, 9),
                name: file.name,
                fileType: file.type,
                content: event.target?.result as string
            };
            setDocuments(prev => [...prev, newDoc]);
        };
        reader.readAsDataURL(file);
    };

    const removeDocument = (id: string) => {
        setDocuments(prev => prev.filter(doc => doc.id !== id));
    };

    const viewDocument = (doc: UploadedDocument) => {
        const win = window.open();
        if (win) {
            win.document.write(`<iframe src="${doc.content}" frameborder="0" style="border:0; top:0px; left:0px; bottom:0px; right:0px; width:100%; height:100%;" allowfullscreen></iframe>`);
        }
    };

    const downloadDocument = (doc: UploadedDocument) => {
        const link = document.createElement('a');
        link.href = doc.content;
        link.download = doc.name;
        link.click();
    };

    const copyToClipboard = (text: string, type: 'email' | 'password') => {
        navigator.clipboard.writeText(text);
        if (type === 'email') {
            setCopiedEmail(true);
            setTimeout(() => setCopiedEmail(false), 2000);
        } else {
            setCopiedPassword(true);
            setTimeout(() => setCopiedPassword(false), 2000);
        }
    };

    const handleNext = () => {
        if (step === 1 && (!formData.firstName || !formData.lastName)) {
            setError('Please fill in required personal details.');
            return;
        }
        if (step === 2 && (!formData.department || !formData.joinedAt)) {
            setError('Please fill in required professional details.');
            return;
        }
        if (step === 3 && (!formData.email)) {
            setError('Please provide a work email address.');
            return;
        }
        setError('');
        setStep(prev => prev + 1);
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');
        setLoading(true);
        setProvisioningStatus('Initializing employee setup...');

        try {
            // 1. Upload documents to storage first (Avoid heavy Base64 JSON payloads)
            const uploadedDocsMetadata = [];
            
            if (documents.length > 0) {
                for (let i = 0; i < documents.length; i++) {
                    const doc = documents[i];
                    setProvisioningStatus(`Uploading document ${i + 1}/${documents.length}: ${doc.name}...`);
                    
                    // Convert Data URL back to File for upload
                    const response = await fetch(doc.content);
                    const blob = await response.blob();
                    const file = new File([blob], doc.name, { type: doc.fileType });
                    
                    try {
                        const { url } = await api.uploadFile(file);
                        uploadedDocsMetadata.push({
                            name: doc.name,
                            fileType: doc.fileType,
                            content: url // Use URL instead of Base64 blob to prevent payload timeout/hang
                        });
                    } catch (uploadErr) {
                        console.error('File upload failed during provisioning:', uploadErr);
                        // Fallback: If upload fails, try sending Base64 for very small files (<500KB)
                        if (blob.size < 500000) {
                            uploadedDocsMetadata.push(doc);
                        } else {
                            throw new Error(`Failed to upload ${doc.name}. The file might be too large or the storage service is busy.`);
                        }
                    }
                }
            }

            setProvisioningStatus('Provisioning work account & credentials...');

            const payload = {
                firstName: formData.firstName,
                lastName: formData.lastName,
                email: formData.email,
                personalEmail: formData.personalEmail,
                roleId: formData.roleId,
                department: formData.department,
                status: formData.status,
                dob: formData.dob ? new Date(formData.dob).toISOString() : undefined,
                gender: formData.gender,
                phone: formData.phone,
                address: formData.address,
                emergencyContact: formData.emergencyContact,
                designation: formData.designation,
                workLocation: formData.workLocation,
                joinedAt: formData.joinedAt ? new Date(formData.joinedAt).toISOString() : undefined,
                documents: uploadedDocsMetadata
            };

            setProvisioningStatus('Syncing system records (Final Step)...');
            const result = await api.createEmployeeAccount(payload);

            addNotification({
                title: 'Employee Onboarded',
                message: `Account created for ${formData.firstName} ${formData.lastName}. Share credentials securely.`,
                type: 'SYSTEM',
                metadata: null
            });

            // Show credentials screen (Step 5) instead of closing immediately
            setCreatedCredentials({ email: result.email, tempPassword: result.tempPassword });
            setStep(5);
        } catch (err: any) {
            console.error('[PROVISIONING ERROR]', err);
            setError(err.message || 'Failed to provision account. Ensure the email is not already in use.');
        } finally {
            setLoading(false);
            setProvisioningStatus('');
        }
    };

    const renderStepIndicators = () => (
        <div style={{ display: 'flex', gap: '8px', marginBottom: '24px' }}>
            {[1, 2, 3, 4].map(num => (
                <div key={num} style={{
                    flex: 1,
                    height: '4px',
                    background: step >= num ? 'var(--purple-main)' : 'rgba(255,255,255,0.1)',
                    borderRadius: '2px',
                    transition: 'var(--transition-smooth)'
                }} />
            ))}
        </div>
    );

    // Step 5: Credentials reveal screen
    if (step === 5 && createdCredentials) {
        return (
            <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.85)', backdropFilter: 'blur(8px)', zIndex: 100, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <div style={{ background: 'var(--bg-dark)', width: '100%', maxWidth: '520px', borderRadius: 'var(--radius-lg)', border: '1px solid var(--glass-border)', overflow: 'hidden' }}>
                    <div style={{ padding: '32px', textAlign: 'center' }}>
                        <div style={{ width: '64px', height: '64px', borderRadius: '50%', background: 'rgba(16,185,129,0.15)', border: '2px solid #10B981', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 20px' }}>
                            <CheckCircle size={32} color="#10B981" />
                        </div>
                        <h2 style={{ fontSize: '1.4rem', fontWeight: 700, color: 'white', margin: '0 0 8px' }}>Account Provisioned</h2>
                        <p style={{ color: 'var(--text-secondary)', fontSize: '0.875rem', margin: '0 0 32px' }}>Share these credentials securely with the employee.</p>

                        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', textAlign: 'left' }}>
                            <div style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid var(--glass-border)', borderRadius: 'var(--radius-sm)', padding: '14px 16px' }}>
                                <div style={{ fontSize: '0.7rem', color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '6px' }}>Login Email</div>
                                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                                    <span style={{ fontFamily: 'monospace', fontSize: '0.95rem', color: 'white' }}>{createdCredentials.email}</span>
                                    <button onClick={() => copyToClipboard(createdCredentials.email, 'email')} style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: copiedEmail ? '#10B981' : 'var(--text-secondary)', padding: '4px', borderRadius: '4px', transition: 'color 0.2s' }}>
                                        {copiedEmail ? <CheckCircle size={16} /> : <Copy size={16} />}
                                    </button>
                                </div>
                            </div>
                            <div style={{ background: 'rgba(139,92,246,0.08)', border: '1px solid rgba(139,92,246,0.3)', borderRadius: 'var(--radius-sm)', padding: '14px 16px' }}>
                                <div style={{ fontSize: '0.7rem', color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '6px' }}>Temporary Password</div>
                                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                                    <span style={{ fontFamily: 'monospace', fontSize: '1.05rem', fontWeight: 700, color: 'var(--purple-light)', letterSpacing: '0.05em' }}>{createdCredentials.tempPassword}</span>
                                    <button onClick={() => copyToClipboard(createdCredentials.tempPassword, 'password')} style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: copiedPassword ? '#10B981' : 'var(--text-secondary)', padding: '4px', borderRadius: '4px', transition: 'color 0.2s' }}>
                                        {copiedPassword ? <CheckCircle size={16} /> : <Copy size={16} />}
                                    </button>
                                </div>
                            </div>
                        </div>

                        <div style={{ marginTop: '16px', padding: '12px', background: 'rgba(245,158,11,0.08)', border: '1px solid rgba(245,158,11,0.2)', borderRadius: 'var(--radius-sm)', fontSize: '0.8rem', color: '#F59E0B', textAlign: 'left' }}>
                            ⚠ This password is shown only once. Copy it before closing.
                        </div>

                        <button onClick={onClose} className="primary-button hoverable" style={{ marginTop: '24px', width: '100%', justifyContent: 'center', background: '#10B981', color: 'black', fontWeight: 600 }}>
                            Done
                        </button>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.85)', backdropFilter: 'blur(8px)', zIndex: 100, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <div style={{ background: 'var(--bg-dark)', width: '100%', maxWidth: '800px', borderRadius: 'var(--radius-lg)', border: '1px solid var(--glass-border)', overflow: 'hidden', display: 'flex', flexDirection: 'column', maxHeight: '90vh' }}>
                <div style={{ padding: '24px 32px', borderBottom: '1px solid var(--glass-border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'rgba(0,0,0,0.2)' }}>
                    <div>
                        <h2 style={{ fontSize: '1.5rem', fontWeight: 600, color: 'white', margin: 0 }}>Create Employee Profile</h2>
                        <p style={{ color: 'var(--text-secondary)', fontSize: '0.875rem', marginTop: '4px' }}>Enterprise Unified Provisioning - Step {step} of 4</p>
                    </div>
                    <button onClick={onClose} style={{ background: 'transparent', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer' }}>
                        <X size={24} />
                    </button>
                </div>

                <div style={{ padding: '32px', overflowY: 'auto', flex: 1 }}>
                    {renderStepIndicators()}

                    <form id="employeeForm" onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
                        {/* STEP 1: PERSONAL DETAILS */}
                        <div style={{ display: step === 1 ? 'block' : 'none' }}>
                            <h3 style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'white', marginBottom: '16px' }}><User size={18} color="var(--purple-main)" /> Personal Details</h3>
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                                <div><label className="input-label">First Name *</label><input required name="firstName" value={formData.firstName} onChange={handleChange} className="input-field" placeholder="John" /></div>
                                <div><label className="input-label">Last Name *</label><input required name="lastName" value={formData.lastName} onChange={handleChange} className="input-field" placeholder="Doe" /></div>
                                <div><label className="input-label">Date of Birth</label><input type="date" name="dob" value={formData.dob} onChange={handleChange} className="input-field" /></div>
                                <div>
                                    <label className="input-label">Gender</label>
                                                                        <select name="gender" value={formData.gender} onChange={handleChange} className="filter-select" style={{ width: '100%' }}>
                                        <option value="MALE">Male</option>
                                        <option value="FEMALE">Female</option>
                                        <option value="OTHER">Other</option>
                                    </select>
                                </div>
                                <div>
                                    <label className="input-label">Phone Number</label>
                                    <input type="text" name="phone" value={formData.phone} onChange={handlePhoneChange} className="input-field" placeholder="10-digit number" />
                                    {phoneError && <p style={{ color: '#EF4444', fontSize: '0.75rem', marginTop: '4px' }}>{phoneError}</p>}
                                </div>
                                <div><label className="input-label">Personal Email</label><input type="email" name="personalEmail" value={formData.personalEmail} onChange={handleChange} className="input-field" placeholder="personal@email.com" /></div>
                                <div style={{ gridColumn: '1 / -1' }}><label className="input-label">Home Address</label><textarea name="address" value={formData.address} onChange={handleChange} className="input-field" placeholder="Full address" rows={2} /></div>
                                <div style={{ gridColumn: '1 / -1' }}><label className="input-label">Emergency Contact Line</label><input name="emergencyContact" value={formData.emergencyContact} onChange={handleChange} className="input-field" placeholder="Name - Relationship - Phone" /></div>
                            </div>
                        </div>

                        {/* STEP 2: PROFESSIONAL DETAILS */}
                        <div style={{ display: step === 2 ? 'block' : 'none' }}>
                            <h3 style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'white', marginBottom: '16px' }}><Briefcase size={18} color="var(--purple-main)" /> Professional Details</h3>
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                                <div>
                                    <label className="input-label">Department *</label>
                                                                        <select required name="department" value={formData.department} onChange={handleChange} className="filter-select" style={{ width: '100%' }}>
                                        <option value="">Select Department</option>
                                        <option value="Operations">Operations</option>
                                        <option value="Engineering">Engineering</option>
                                        <option value="Creative">Creative</option>
                                        <option value="Human Resources">Human Resources</option>
                                    </select>
                                </div>
                                <div><label className="input-label">Designation</label><input name="designation" value={formData.designation} onChange={handleChange} className="input-field" placeholder="Senior Developer" /></div>
                                <div><label className="input-label">Joining Date *</label><input required type="date" name="joinedAt" value={formData.joinedAt} onChange={handleChange} className="input-field" /></div>
                                <div>
                                    <label className="input-label">Location</label>
                                                                        <select name="workLocation" value={formData.workLocation} onChange={handleChange} className="filter-select" style={{ width: '100%' }}>
                                        <option value="OFFICE">Office</option>
                                        <option value="REMOTE">Remote</option>
                                        <option value="HYBRID">Hybrid</option>
                                    </select>
                                </div>
                            </div>
                        </div>

                        {/* STEP 3: SYSTEM ROLE */}
                        <div style={{ display: step === 3 ? 'block' : 'none' }}>
                            <h3 style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'white', marginBottom: '8px' }}><Key size={18} color="var(--purple-main)" /> System Credentials</h3>
                            <div style={{ padding: '12px 16px', background: 'rgba(139,92,246,0.08)', borderRadius: 'var(--radius-sm)', fontSize: '0.8rem', color: 'var(--purple-light)', marginBottom: '20px' }}>
                                🔒 Password will be auto-generated.
                            </div>
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                                <div style={{ gridColumn: '1 / -1' }}><label className="input-label">Work Email *</label><input required type="email" name="email" value={formData.email} onChange={handleChange} className="input-field" placeholder="user@triples.os" /></div>
                                <div>
                                    <label className="input-label">Role *</label>
                                                                        <select required name="roleId" value={formData.roleId} onChange={handleChange} className="filter-select" style={{ width: '100%' }}>
                                        <option value="EMPLOYEE">Employee</option>
                                        <option value="MANAGER">Manager</option>
                                        <option value="ADMIN">Admin</option>
                                    </select>
                                </div>
                                <div>
                                    <label className="input-label">Status *</label>
                                                                        <select required name="status" value={formData.status} onChange={handleChange} className="filter-select" style={{ width: '100%' }}>
                                        <option value="ACTIVE">Active</option>
                                        <option value="INACTIVE">Inactive</option>
                                    </select>
                                </div>
                            </div>
                        </div>

                        {/* STEP 4: DOCUMENTS */}
                        <div style={{ display: step === 4 ? 'block' : 'none' }}>
                            <h3 style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'white', marginBottom: '16px' }}><FileText size={18} color="var(--purple-main)" /> Documents</h3>
                            <div onClick={() => fileInputRef.current?.click()} style={{ padding: '32px', border: '2px dashed var(--glass-border)', borderRadius: 'var(--radius-md)', textAlign: 'center', cursor: 'pointer' }}>
                                <Plus size={32} color="var(--purple-main)" style={{ margin: '0 auto 12px' }} />
                                <div>Click to upload documents</div>
                                <input type="file" ref={fileInputRef} style={{ display: 'none' }} accept=".pdf,.jpg,.jpeg,.png" onChange={handleFileUpload} />
                            </div>
                            <div style={{ marginTop: '20px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                                {documents.map(doc => (
                                    <div key={doc.id} style={{ padding: '10px 16px', background: 'rgba(255,255,255,0.05)', borderRadius: 'var(--radius-sm)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                        <div style={{ fontSize: '0.875rem' }}>{doc.name}</div>
                                        <div style={{ display: 'flex', gap: '8px' }}>
                                            <button type="button" onClick={() => viewDocument(doc)} className="action-btn"><Eye size={14} /></button>
                                            <button type="button" onClick={() => removeDocument(doc.id)} className="action-btn danger-hover"><Trash2 size={14} /></button>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                        {error && <div style={{ color: '#EF4444', fontSize: '0.875rem' }}>{error}</div>}
                    </form>
                </div>

                <div style={{ padding: '24px 32px', background: 'rgba(0,0,0,0.3)', borderTop: '1px solid var(--glass-border)' }}>
                    {provisioningStatus && (
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--purple-accent)', fontSize: '0.8rem', marginBottom: '16px' }}>
                            <div className="spinner-mini" style={{ width: '12px', height: '12px', border: '2px solid rgba(139,92,246,0.1)', borderTop: '2px solid var(--purple-accent)', borderRadius: '50%' }} />
                            {provisioningStatus}
                        </div>
                    )}
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                        <button type="button" className="secondary-button" onClick={onClose} disabled={loading}>Cancel</button>
                        <div style={{ display: 'flex', gap: '12px' }}>
                            {step > 1 && <button type="button" className="secondary-button" onClick={() => setStep(s => s - 1)} disabled={loading}>Back</button>}
                            {step < 4 ? (
                                <button type="button" className="primary-button" onClick={handleNext}>Next</button>
                            ) : (
                                <button type="submit" form="employeeForm" className="primary-button" disabled={loading} style={{ background: '#10B981', color: 'black' }}>
                                    {loading ? 'Provisioning...' : 'Provision Account'}
                                </button>
                            )}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default CreateEmployeeModal;
