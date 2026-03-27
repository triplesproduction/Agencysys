import { useState, useRef } from 'react';
import { X, User, Briefcase, Key, ChevronRight, ChevronLeft, Save, FileText, Plus, Eye, Trash2, Download, Copy, CheckCircle } from 'lucide-react';
import { api } from '@/lib/api';
import { useNotifications } from '@/components/notifications/NotificationProvider';

interface UploadedDocument {
    id: string;
    name: string;
    fileType: string;
    content: string; // Base64
}

export default function CreateEmployeeModal({ onClose }: { onClose: () => void }) {
    const { addNotification } = useNotifications();
    const [step, setStep] = useState(1);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [phoneError, setPhoneError] = useState('');
    const fileInputRef = useRef<HTMLInputElement>(null);

    // Credentials shown after successful creation
    const [createdCredentials, setCreatedCredentials] = useState<{ email: string; tempPassword: string } | null>(null);
    const [copiedEmail, setCopiedEmail] = useState(false);
    const [copiedPassword, setCopiedPassword] = useState(false);

    // Form State
    const [formData, setFormData] = useState({
        // Personal
        firstName: '',
        lastName: '',
        personalEmail: '',
        phone: '',
        dob: '',
        gender: 'OTHER',
        address: '',
        emergencyContact: '',
        // Professional
        department: '',
        designation: '',
        workLocation: 'OFFICE',
        joinedAt: new Date().toISOString().split('T')[0],
        reportingManager: '',
        // System
        email: '', // Work Email
        roleId: 'EMPLOYEE',
        status: 'ACTIVE'
    });

    const [documents, setDocuments] = useState<UploadedDocument[]>([]);

    const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
        setFormData(prev => ({ ...prev, [e.target.name]: e.target.value }));
        if (error) setError('');
    };

    const handlePhoneChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const digits = e.target.value.replace(/\D/g, '');
        if (digits.length > 10) {
            setPhoneError('Phone number cannot exceed 10 digits.');
        } else {
            setPhoneError('');
        }
        setFormData(prev => ({ ...prev, phone: digits.slice(0, 10) }));
    };

    const copyToClipboard = async (text: string, field: 'email' | 'password') => {
        await navigator.clipboard.writeText(text);
        if (field === 'email') {
            setCopiedEmail(true);
            setTimeout(() => setCopiedEmail(false), 2000);
        } else {
            setCopiedPassword(true);
            setTimeout(() => setCopiedPassword(false), 2000);
        }
    };

    const validateStep = (currentStep: number) => {
        switch (currentStep) {
            case 1:
                if (!formData.firstName.trim()) return 'First Name is required.';
                if (!formData.lastName.trim()) return 'Last Name is required.';
                return null;
            case 2:
                if (!formData.department) return 'Department is required.';
                if (!formData.joinedAt) return 'Joining Date is required.';
                return null;
            case 3:
                if (!formData.email.trim()) return 'Work Email is required.';
                return null;
            default:
                return null;
        }
    };

    const handleNext = () => {
        const err = validateStep(step);
        if (err) {
            setError(err);
            return;
        }
        setError('');
        setStep(s => s + 1);
    };

    const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        // Validation: Format
        const allowedTypes = ['application/pdf', 'image/jpeg', 'image/jpg', 'image/png'];
        if (!allowedTypes.includes(file.type)) {
            alert('Invalid format. Supported: PDF, JPG, PNG.');
            return;
        }

        // Validation: Size (5MB)
        if (file.size > 5 * 1024 * 1024) {
            alert('File size too large. Maximum 5MB per file.');
            return;
        }

        const reader = new FileReader();
        reader.onloadend = () => {
            const base64Content = reader.result as string;
            const newDoc: UploadedDocument = {
                id: Math.random().toString(36).substr(2, 9),
                name: file.name,
                fileType: file.type,
                content: base64Content
            };
            setDocuments(prev => [...prev, newDoc]);
        };
        reader.readAsDataURL(file);
        // Reset input
        e.target.value = '';
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

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');
        setLoading(true);

        try {
            const payload = {
                firstName: formData.firstName,
                lastName: formData.lastName,
                email: formData.email,
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
                documents: documents.map(d => ({
                    name: d.name,
                    fileType: d.fileType,
                    content: d.content
                }))
            };

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
            setError(err.message || 'Failed to provision account. Ensure the email is not already in use.');
        } finally {
            setLoading(false);
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
                            {/* Email */}
                            <div style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid var(--glass-border)', borderRadius: 'var(--radius-sm)', padding: '14px 16px' }}>
                                <div style={{ fontSize: '0.7rem', color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '6px' }}>Login Email</div>
                                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                                    <span style={{ fontFamily: 'monospace', fontSize: '0.95rem', color: 'white' }}>{createdCredentials.email}</span>
                                    <button onClick={() => copyToClipboard(createdCredentials.email, 'email')} style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: copiedEmail ? '#10B981' : 'var(--text-secondary)', padding: '4px', borderRadius: '4px', transition: 'color 0.2s' }} title="Copy email">
                                        {copiedEmail ? <CheckCircle size={16} /> : <Copy size={16} />}
                                    </button>
                                </div>
                            </div>

                            {/* Password */}
                            <div style={{ background: 'rgba(139,92,246,0.08)', border: '1px solid rgba(139,92,246,0.3)', borderRadius: 'var(--radius-sm)', padding: '14px 16px' }}>
                                <div style={{ fontSize: '0.7rem', color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '6px' }}>Temporary Password</div>
                                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                                    <span style={{ fontFamily: 'monospace', fontSize: '1.05rem', fontWeight: 700, color: 'var(--purple-light)', letterSpacing: '0.05em' }}>{createdCredentials.tempPassword}</span>
                                    <button onClick={() => copyToClipboard(createdCredentials.tempPassword, 'password')} style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: copiedPassword ? '#10B981' : 'var(--text-secondary)', padding: '4px', borderRadius: '4px', transition: 'color 0.2s' }} title="Copy password">
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
                        <p style={{ color: 'rgba(139,92,246,0.8)', fontSize: '0.75rem', marginTop: '2px' }}>🔒 Auth account created securely by server</p>
                    </div>
                    <button onClick={onClose} style={{ background: 'transparent', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer' }}>
                        <X size={24} />
                    </button>
                </div>

                <div style={{ padding: '32px', overflowY: 'auto', flex: 1 }}>
                    {renderStepIndicators()}

                    <form id="employeeForm" onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>

                        {/* STEP 1: PERSONAL DETAILS */}
                        <div style={{ display: step === 1 ? 'block' : 'none' }} className="fade-in">
                            <h3 style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'white', marginBottom: '16px' }}><User size={18} color="var(--purple-main)" /> Personal Details</h3>
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                                <div><label className="input-label">First Name *</label><input required name="firstName" value={formData.firstName} onChange={handleChange} className="input-field" placeholder="John" /></div>
                                <div><label className="input-label">Last Name *</label><input required name="lastName" value={formData.lastName} onChange={handleChange} className="input-field" placeholder="Doe" /></div>
                                <div><label className="input-label">Date of Birth</label><input type="date" name="dob" value={formData.dob} onChange={handleChange} className="input-field" /></div>
                                <div>
                                    <label className="input-label">Gender</label>
                                    <select name="gender" value={formData.gender} onChange={handleChange} className="input-field" style={{ background: 'var(--bg-dark)' }}>
                                        <option value="MALE">Male</option>
                                        <option value="FEMALE">Female</option>
                                        <option value="OTHER">Other</option>
                                    </select>
                                </div>
                                <div>
                                    <label className="input-label">Phone Number</label>
                                    <input
                                        type="text"
                                        name="phone"
                                        value={formData.phone}
                                        onChange={handlePhoneChange}
                                        className="input-field"
                                        placeholder="e.g. 9876543210"
                                        maxLength={10}
                                        style={{ borderColor: phoneError ? '#EF4444' : undefined }}
                                    />
                                    {phoneError && (
                                        <p style={{ color: '#EF4444', fontSize: '0.75rem', marginTop: '4px', marginBottom: 0 }}>⚠ {phoneError}</p>
                                    )}
                                </div>
                                <div><label className="input-label">Personal Email</label><input type="email" name="personalEmail" value={formData.personalEmail} onChange={handleChange} className="input-field" placeholder="personal@email.com" /></div>
                                <div style={{ gridColumn: '1 / -1' }}><label className="input-label">Home Address</label><textarea name="address" value={formData.address} onChange={handleChange} className="input-field" placeholder="Full residential physical address" rows={2} /></div>
                                <div style={{ gridColumn: '1 / -1' }}><label className="input-label">Emergency Contact Line</label><input name="emergencyContact" value={formData.emergencyContact} onChange={handleChange} className="input-field" placeholder="Name - Relationship - Phone" /></div>
                            </div>
                        </div>

                        {/* STEP 2: PROFESSIONAL DETAILS */}
                        <div style={{ display: step === 2 ? 'block' : 'none' }} className="fade-in">
                            <h3 style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'white', marginBottom: '16px' }}><Briefcase size={18} color="var(--purple-main)" /> Professional Details</h3>
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                                <div>
                                    <label className="input-label">Department *</label>
                                    <select required name="department" value={formData.department} onChange={handleChange} className="input-field" style={{ background: 'var(--bg-dark)' }}>
                                        <option value="">Select Department</option>
                                        <option value="Operations">Operations</option>
                                        <option value="Engineering">Engineering</option>
                                        <option value="Creative">Creative</option>
                                        <option value="Human Resources">Human Resources</option>
                                    </select>
                                </div>
                                <div><label className="input-label">Designation Title</label><input name="designation" value={formData.designation} onChange={handleChange} className="input-field" placeholder="e.g. Senior Frontend Developer" /></div>
                                <div><label className="input-label">Joining Date *</label><input required type="date" name="joinedAt" value={formData.joinedAt} onChange={handleChange} className="input-field" /></div>
                                <div>
                                    <label className="input-label">Work Location</label>
                                    <select name="workLocation" value={formData.workLocation} onChange={handleChange} className="input-field" style={{ background: 'var(--bg-dark)' }}>
                                        <option value="OFFICE">Office</option>
                                        <option value="REMOTE">Remote</option>
                                        <option value="HYBRID">Hybrid</option>
                                    </select>
                                </div>
                                <div style={{ gridColumn: '1 / -1' }}><label className="input-label">Reporting Manager ID</label><input name="reportingManager" value={formData.reportingManager} onChange={handleChange} className="input-field" placeholder="EMP-XXX" /></div>
                            </div>
                        </div>

                        {/* STEP 3: SYSTEM CREDENTIALS */}
                        <div style={{ display: step === 3 ? 'block' : 'none' }} className="fade-in">
                            <h3 style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'white', marginBottom: '8px' }}><Key size={18} color="var(--purple-main)" /> System Credentials</h3>
                            <div style={{ padding: '12px 16px', background: 'rgba(139,92,246,0.08)', border: '1px solid rgba(139,92,246,0.2)', borderRadius: 'var(--radius-sm)', fontSize: '0.8rem', color: 'var(--purple-light)', marginBottom: '20px' }}>
                                🔒 A secure temporary password will be <strong>auto-generated by the server</strong> and shown to you after creation.
                            </div>
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                                <div style={{ gridColumn: '1 / -1' }}><label className="input-label">Work Email (Login ID) *</label><input required type="email" name="email" value={formData.email} onChange={handleChange} className="input-field" placeholder="user@triples.os" /></div>
                                <div>
                                    <label className="input-label">System Role *</label>
                                    <select required name="roleId" value={formData.roleId} onChange={handleChange} className="input-field" style={{ background: 'var(--bg-dark)' }}>
                                        <option value="EMPLOYEE">Standard Employee</option>
                                        <option value="MANAGER">Manager</option>
                                        <option value="ADMIN">System Administrator</option>
                                    </select>
                                </div>
                                <div>
                                    <label className="input-label">Account Status *</label>
                                    <select required name="status" value={formData.status} onChange={handleChange} className="input-field" style={{ background: 'var(--bg-dark)' }}>
                                        <option value="ACTIVE">Active</option>
                                        <option value="INACTIVE">Inactive / Pre-board</option>
                                    </select>
                                </div>
                            </div>
                        </div>

                        {/* STEP 4: DOCUMENTS */}
                        <div style={{ display: step === 4 ? 'block' : 'none' }} className="fade-in">
                            <h3 style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'white', marginBottom: '16px' }}><FileText size={18} color="var(--purple-main)" /> Documents & Attachments</h3>

                            <div
                                onClick={() => fileInputRef.current?.click()}
                                style={{ padding: '32px', border: '2px dashed var(--glass-border)', borderRadius: 'var(--radius-md)', textAlign: 'center', cursor: 'pointer', background: 'rgba(255,255,255,0.02)' }}
                                className="hoverable"
                            >
                                <Plus size={32} color="var(--purple-main)" style={{ margin: '0 auto 12px' }} />
                                <div style={{ fontWeight: 600 }}>Click to upload documents</div>
                                <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginTop: '4px' }}>Aadhaar, PAN, Resume, etc. (PDF, JPG, PNG up to 5MB)</div>
                                <input
                                    type="file"
                                    ref={fileInputRef}
                                    style={{ display: 'none' }}
                                    accept=".pdf,.jpg,.jpeg,.png"
                                    onChange={handleFileUpload}
                                />
                            </div>

                            <div style={{ marginTop: '24px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
                                {documents.length > 0 ? (
                                    documents.map(doc => (
                                        <div key={doc.id} style={{ padding: '12px 16px', background: 'rgba(255,255,255,0.05)', border: '1px solid var(--glass-border)', borderRadius: 'var(--radius-sm)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                                                <FileText size={20} color="var(--text-secondary)" />
                                                <div>
                                                    <div style={{ fontSize: '0.875rem', fontWeight: 500 }}>{doc.name}</div>
                                                    <div style={{ fontSize: '0.7rem', color: 'var(--text-secondary)' }}>{doc.fileType.split('/')[1].toUpperCase()}</div>
                                                </div>
                                            </div>
                                            <div style={{ display: 'flex', gap: '8px' }}>
                                                <button type="button" title="View" onClick={() => viewDocument(doc)} className="action-btn"><Eye size={16} /></button>
                                                <button type="button" title="Download" onClick={() => downloadDocument(doc)} className="action-btn"><Download size={16} /></button>
                                                <button type="button" title="Delete" onClick={() => removeDocument(doc.id)} className="action-btn danger-hover"><Trash2 size={16} /></button>
                                            </div>
                                        </div>
                                    ))
                                ) : (
                                    <div style={{ textAlign: 'center', padding: '24px', color: 'var(--text-secondary)', fontSize: '0.875rem', background: 'rgba(0,0,0,0.1)', borderRadius: 'var(--radius-sm)' }}>No documents uploaded yet.</div>
                                )}
                            </div>
                        </div>

                        {error && <div style={{ padding: '12px', background: 'rgba(239, 68, 68, 0.1)', color: '#EF4444', borderRadius: '4px', fontSize: '0.875rem' }}>{error}</div>}
                    </form>
                </div>

                <div style={{ padding: '24px 32px', background: 'rgba(0,0,0,0.3)', borderTop: '1px solid var(--glass-border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <button type="button" className="secondary-button" onClick={onClose} disabled={loading}>Cancel</button>

                    <div style={{ display: 'flex', gap: '12px' }}>
                        {step > 1 && (
                            <button type="button" className="secondary-button hoverable" onClick={() => setStep(s => s - 1)} style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                <ChevronLeft size={16} /> Back
                            </button>
                        )}
                        {step < 4 ? (
                            <button type="button" className="primary-button hoverable" onClick={handleNext} style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                Next <ChevronRight size={16} />
                            </button>
                        ) : (
                            <button type="submit" form="employeeForm" className="primary-button hoverable" disabled={loading} style={{ display: 'flex', alignItems: 'center', gap: '8px', background: '#10B981', color: 'black' }}>
                                <Save size={16} /> {loading ? 'Provisioning...' : 'Provision Account'}
                            </button>
                        )}
                    </div>
                </div>

            </div>
        </div>
    );
}
