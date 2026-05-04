import React, { useState, useRef } from 'react';
import { X, User, Briefcase, Key, FileText, Plus, Save, Download, Trash2, Eye, ChevronRight, ChevronLeft, CheckCircle, Copy, Image as ImageIcon } from 'lucide-react';
import { api } from '../../lib/api';
import DatePicker from '../common/DatePicker';

interface UploadedDocument {
    id: string;
    name: string;
    fileType: string;
    content: string; // Base64
}

const DEPARTMENT_ROLES: Record<string, string[]> = {
    'Admin': ['Admin'],
    'Operations': ['Manager', 'Project Manager', 'Sales Executive'],
    'Marketing': ['Digital Marketer', 'SEO Specialist', 'Social Media Manager'],
    'Development': ['Website Developer', 'AI Journalist', 'UI Designer', 'App Developer', 'Software Developer', 'QA Tester'],
    'Content Creation': ['Model', 'Influencer', 'Cameraman', 'Cinematographer'],
    'Creative': ['Graphics Designer', 'Video Editor', 'Content Writer']
};

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
        email: '',
        firstName: '',
        lastName: '',
        personalEmail: '',
        roleId: 'EMPLOYEE',
        department: '',
        designation: '',
        phone: '',
        address: '',
        dob: '',
        gender: '',
        workLocation: 'OFFICE',
        emergencyContact: '',
        joinedAt: new Date().toISOString().split('T')[0],
        employmentType: 'FULL_TIME',
        internshipStatus: '',
        internshipStipend: 0,
        baseSalary: 0,
        experience: 0,
        profilePhoto: '',
        status: 'ACTIVE'
    });

    const [profilePhotoPreview, setProfilePhotoPreview] = useState<string | null>(null);
    const photoInputRef = useRef<HTMLInputElement>(null);

    const [phoneError, setPhoneError] = useState('');
    const [isUploadingPhoto, setIsUploadingPhoto] = useState(false);
    const [isUploadingDoc, setIsUploadingDoc] = useState(false);

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

    const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        if (file.size > 2 * 1024 * 1024) {
            alert('Profile photo exceeds 2MB limit.');
            return;
        }

        const reader = new FileReader();
        reader.onload = (event) => {
            setProfilePhotoPreview(event.target?.result as string);
        };
        reader.readAsDataURL(file);

        try {
            setIsUploadingPhoto(true);
            const { url } = await api.uploadPhoto(file);
            setFormData(prev => ({ ...prev, profilePhoto: url }));
        } catch (err: any) {
            console.error('Photo upload failed', err);
            alert('Failed to upload profile photo.');
            setProfilePhotoPreview(null);
        } finally {
            setIsUploadingPhoto(false);
        }
    };

    const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        if (file.size > 4 * 1024 * 1024) {
            alert('Document exceeds the 4MB security threshold. Please optimize.');
            return;
        }

        try {
            setIsUploadingDoc(true);
            const { url } = await api.uploadFile(file);
            const newDoc: UploadedDocument = {
                id: Math.random().toString(36).substr(2, 9),
                name: file.name,
                fileType: file.type,
                content: url
            };
            setDocuments(prev => [...prev, newDoc]);
        } catch (err: any) {
            console.error('Document upload failed', err);
            alert(`Failed to upload ${file.name}.`);
        } finally {
            setIsUploadingDoc(false);
            if (e.target) e.target.value = '';
        }
    };

    const removeDocument = (id: string) => {
        setDocuments(prev => prev.filter(doc => doc.id !== id));
    };

    const viewDocument = (doc: UploadedDocument) => {
        const win = window.open();
        if (win) {
            const isImage = doc.fileType.startsWith('image/');
            win.document.title = doc.name;
            win.document.write(`
                <html>
                    <head>
                        <style>
                            body { 
                                margin: 0; 
                                background: #0f0f14; 
                                display: flex; 
                                flex-direction: column;
                                align-items: center; 
                                min-height: 100vh; 
                                overflow-y: auto; 
                                font-family: 'Inter', sans-serif;
                                padding: 40px 20px;
                                box-sizing: border-box;
                            }
                            img { 
                                max-width: 100%; 
                                height: auto; 
                                display: block; 
                                border-radius: 12px; 
                                box-shadow: 0 30px 60px rgba(0,0,0,0.5); 
                                border: 1px solid rgba(255,255,255,0.1);
                            }
                            iframe { border: none; width: 100vw; height: 100vh; background: white; }
                            .toolbar { 
                                position: fixed; 
                                top: 20px; 
                                left: 50%;
                                transform: translateX(-50%);
                                background: rgba(0,0,0,0.7); 
                                backdrop-filter: blur(10px); 
                                padding: 10px 24px; 
                                border-radius: 30px; 
                                color: white; 
                                font-size: 13px; 
                                font-weight: 600;
                                z-index: 100; 
                                border: 1px solid rgba(255,255,255,0.1);
                                box-shadow: 0 10px 30px rgba(0,0,0,0.3);
                            }
                        </style>
                    </head>
                    <body>
                        <div class="toolbar">${doc.name}</div>
                        ${isImage 
                            ? `<img src="${doc.content}" alt="${doc.name}" />`
                            : `<iframe src="${doc.content}" allowfullscreen></iframe>`
                        }
                    </body>
                </html>
            `);
            win.document.close();
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
        if (step === 1 && (!formData.firstName || !formData.lastName || !formData.personalEmail)) {
            setError('Please fill in required personal details (Name and Personal Email).');
            return;
        }
        if (step === 2 && (!formData.department || !formData.joinedAt)) {
            setError('Please fill in required professional details.');
            return;
        }
        if (step === 2 && !formData.designation) {
            setError('Please select a designation/role.');
            return;
        }
        // Step 3 = Documents (no required fields — optional uploads)
        // Step 4 = System Credentials (email required)
        if (step === 4 && !formData.email) {
            setError('Please provide a valid work email address for credential provisioning.');
            return;
        }
        setError('');
        setStep(prev => prev + 1);
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        // Guard: only submit when on the final step (step 4 = Credentials)
        // Prevents accidental form submission via Enter key on earlier steps
        if (step !== 4) {
            handleNext();
            return;
        }
        setError('');
        setLoading(true);
        setProvisioningStatus('Initializing employee setup...');

        try {
            setProvisioningStatus('Provisioning work account & credentials...');

            const payload = {
                ...formData,
                dob: formData.dob || undefined,
                joinedAt: formData.joinedAt || undefined,
                documents: documents,
                profilePhoto: formData.profilePhoto
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
            {['Personal info', 'Professional', 'Documents', 'Login Details'].map((title, idx) => {
                const num = idx + 1;
                const isActive = step >= num;
                return (
                    <div key={num} style={{ flex: 1 }}>
                        <div style={{
                            height: '4px',
                            background: isActive ? 'var(--purple-main)' : 'rgba(255,255,255,0.1)',
                            borderRadius: '2px',
                            transition: 'all 0.4s ease'
                        }} />
                        <div style={{ fontSize: '0.65rem', textTransform: 'uppercase', marginTop: '6px', color: isActive ? 'var(--purple-light)' : 'rgba(255,255,255,0.2)', fontWeight: 700, letterSpacing: '0.05em' }}>
                            {title}
                        </div>
                    </div>
                );
            })}
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
                            <div style={{ display: 'flex', gap: '24px', alignItems: 'flex-start', marginBottom: '24px' }}>
                                <div style={{ position: 'relative' }}>
                                    <div 
                                        onClick={() => photoInputRef.current?.click()}
                                        style={{ 
                                            width: '100px', 
                                            height: '100px', 
                                            borderRadius: '24px', 
                                            background: 'rgba(255,255,255,0.03)', 
                                            border: '2px dashed var(--glass-border)',
                                            display: 'flex',
                                            alignItems: 'center',
                                            justifyContent: 'center',
                                            cursor: 'pointer',
                                            overflow: 'hidden',
                                            transition: 'all 0.3s'
                                        }}
                                        className="hoverable"
                                    >
                                        {profilePhotoPreview ? (
                                            <img src={profilePhotoPreview} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                                        ) : (
                                            <ImageIcon size={32} style={{ opacity: 0.3 }} />
                                        )}
                                        {isUploadingPhoto ? (
                                            <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                                <Loader2 size={20} color="white" className="animate-spin" />
                                            </div>
                                        ) : (
                                            <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', opacity: 0, transition: 'opacity 0.3s' }} className="photo-overlay">
                                                <Plus size={20} color="white" />
                                            </div>
                                        )}

                                    </div>
                                    <input type="file" ref={photoInputRef} style={{ display: 'none' }} accept="image/*" onChange={handlePhotoUpload} />
                                    <div style={{ fontSize: '0.65rem', color: 'var(--text-secondary)', textAlign: 'center', marginTop: '8px', fontWeight: 600, textTransform: 'uppercase' }}>Photo</div>
                                </div>
                                <div style={{ flex: 1 }}>
                                    <h3 style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'white', marginBottom: '12px' }}><User size={18} color="var(--purple-main)" /> Personal Details</h3>
                                    <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', margin: 0 }}>Basic identification and contact information.</p>
                                </div>
                            </div>

                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                                <div><label className="input-label">First Name *</label><input name="firstName" value={formData.firstName} onChange={handleChange} className="input-field" placeholder="John" /></div>
                                <div><label className="input-label">Last Name *</label><input name="lastName" value={formData.lastName} onChange={handleChange} className="input-field" placeholder="Doe" /></div>
                                <div>
                                    <DatePicker 
                                        label="Date of Birth"
                                        value={formData.dob}
                                        onChange={(dt) => setFormData(prev => ({ ...prev, dob: dt }))}
                                    />
                                </div>
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
                                <div><label className="input-label">Personal Email *</label><input type="email" name="personalEmail" value={formData.personalEmail} onChange={handleChange} className="input-field" placeholder="personal@email.com" /></div>
                                <div style={{ gridColumn: '1 / -1' }}><label className="input-label">Home Address</label><textarea name="address" value={formData.address} onChange={handleChange} className="input-field" placeholder="Full address" rows={2} /></div>
                                <div style={{ gridColumn: '1 / -1' }}><label className="input-label">Emergency Contact Line</label><input name="emergencyContact" value={formData.emergencyContact} onChange={handleChange} className="input-field" placeholder="Name - Relationship - Phone" /></div>
                            </div>
                        </div>

                        {/* STEP 2: PROFESSIONAL DETAILS & PAYROLL */}
                        <div style={{ display: step === 2 ? 'block' : 'none' }}>
                            <h3 style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'white', marginBottom: '16px' }}>
                                <Briefcase size={18} color="var(--purple-main)" /> Professional Profile
                            </h3>
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                                <div>
                                    <label className="input-label">Department *</label>
                                    <select 
                                        name="department" 
                                        value={formData.department} 
                                        onChange={(e) => {
                                            const dept = e.target.value;
                                            setFormData(prev => ({ 
                                                ...prev, 
                                                department: dept,
                                                designation: DEPARTMENT_ROLES[dept]?.[0] || ''
                                            }));
                                        }} 
                                        className="filter-select" 
                                        style={{ width: '100%' }}
                                    >
                                        <option value="">Select Department</option>
                                        {Object.keys(DEPARTMENT_ROLES).map(dept => (
                                            <option key={dept} value={dept}>{dept}</option>
                                        ))}
                                    </select>
                                </div>
                                <div>
                                    <label className="input-label">Designation / Role *</label>
                                    <select 
                                        name="designation" 
                                        value={formData.designation} 
                                        onChange={handleChange} 
                                        className="filter-select" 
                                        style={{ width: '100%' }}
                                    >
                                        <option value="">— Select Role —</option>
                                        {formData.department
                                            ? DEPARTMENT_ROLES[formData.department]?.map(role => (
                                                <option key={role} value={role}>{role}</option>
                                            ))
                                            : Object.entries(DEPARTMENT_ROLES).map(([dept, roles]) => (
                                                <optgroup key={dept} label={dept}>
                                                    {roles.map(role => (
                                                        <option key={role} value={role}>{role}</option>
                                                    ))}
                                                </optgroup>
                                            ))
                                        }
                                    </select>
                                </div>

                                <div>
                                    <label className="input-label">Employment Type *</label>
                                    <select 
                                        name="employmentType" 
                                        value={formData.employmentType} 
                                        onChange={(e) => {
                                            const type = e.target.value;
                                            setFormData(prev => ({ 
                                                ...prev, 
                                                employmentType: type as any,
                                                internshipStatus: type === 'INTERNSHIP' ? 'PAID' : '',
                                                internshipStipend: 0
                                            }));
                                        }} 
                                        className="filter-select" 
                                        style={{ width: '100%' }}
                                    >
                                        <option value="FULL_TIME">Full Time</option>
                                        <option value="PART_TIME">Part Time</option>
                                        <option value="INTERNSHIP">Internship</option>
                                    </select>
                                </div>

                                {formData.employmentType === 'INTERNSHIP' && (
                                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                                        <div>
                                            <label className="input-label">Type</label>
                                            <select 
                                                name="internshipStatus" 
                                                value={formData.internshipStatus} 
                                                onChange={handleChange} 
                                                className="filter-select" 
                                                style={{ width: '100%' }}
                                            >
                                                <option value="PAID">Paid</option>
                                                <option value="UNPAID">Unpaid</option>
                                            </select>
                                        </div>
                                        {formData.internshipStatus === 'PAID' && (
                                            <div>
                                                <label className="input-label">Stipend</label>
                                                <input 
                                                    type="number" 
                                                    name="internshipStipend" 
                                                    value={formData.internshipStipend} 
                                                    onChange={handleChange} 
                                                    className="input-field" 
                                                    placeholder="Stipend" 
                                                />
                                            </div>
                                        )}
                                    </div>
                                )}

                                <div>
                                    <label className="input-label">Monthly Salary (Base)</label>
                                    <input 
                                        type="number" 
                                        name="baseSalary" 
                                        value={formData.baseSalary} 
                                        onChange={handleChange} 
                                        className="input-field" 
                                        placeholder="Enter CTC" 
                                    />
                                </div>

                                <div>
                                    <label className="input-label">Experience (Years)</label>
                                    <input 
                                        type="number" 
                                        step="0.1"
                                        name="experience" 
                                        value={formData.experience} 
                                        onChange={handleChange} 
                                        className="input-field" 
                                        placeholder="e.g. 2.5" 
                                    />
                                </div>

                                <div>
                                    <DatePicker 
                                        label="Joining Date"
                                        required
                                        value={formData.joinedAt}
                                        onChange={(dt) => setFormData(prev => ({ ...prev, joinedAt: dt }))}
                                    />
                                </div>
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

                        {/* STEP 3: DOCUMENTS */}
                        <div style={{ display: step === 3 ? 'block' : 'none' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '8px' }}>
                                <div style={{ background: 'rgba(139,92,246,0.1)', padding: '8px', borderRadius: '10px' }}>
                                    <FileText size={20} color="var(--purple-main)" />
                                </div>
                                <div>
                                    <h3 style={{ color: 'white', margin: 0, fontSize: '1.1rem', fontWeight: 700 }}>Document Repository</h3>
                                    <p style={{ color: 'var(--text-secondary)', fontSize: '0.8rem', margin: 0, opacity: 0.7 }}>Securely upload identity proofs or contracts.</p>
                                </div>
                            </div>
                            
                            <div 
                                onClick={() => !isUploadingDoc && fileInputRef.current?.click()}
                                style={{ 
                                    border: '2px dashed rgba(255,255,255,0.08)', 
                                    borderRadius: '20px', 
                                    padding: '40px 20px', 
                                    textAlign: 'center', 
                                    cursor: isUploadingDoc ? 'wait' : 'pointer',
                                    background: 'rgba(255,255,255,0.02)',
                                    transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                                    marginTop: '24px',
                                    display: 'flex',
                                    flexDirection: 'column',
                                    alignItems: 'center',
                                    gap: '12px',
                                    opacity: isUploadingDoc ? 0.6 : 1
                                }}
                                onMouseEnter={e => {
                                    if(isUploadingDoc) return;
                                    e.currentTarget.style.borderColor = 'var(--purple-main)';
                                    e.currentTarget.style.background = 'rgba(139,92,246,0.03)';
                                }}
                                onMouseLeave={e => {
                                    if(isUploadingDoc) return;
                                    e.currentTarget.style.borderColor = 'rgba(255,255,255,0.08)';
                                    e.currentTarget.style.background = 'rgba(255,255,255,0.02)';
                                }}
                            >
                                <div style={{ width: '48px', height: '48px', borderRadius: '50%', background: 'rgba(255,255,255,0.03)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                    {isUploadingDoc ? <Loader2 size={24} className="animate-spin" style={{ color: 'var(--purple-main)' }} /> : <Plus size={24} style={{ color: 'rgba(255,255,255,0.4)' }} />}
                                </div>
                                <div>
                                    <div style={{ color: 'white', fontWeight: 600, fontSize: '0.9rem' }}>{isUploadingDoc ? 'Uploading...' : 'Click or drag to upload'}</div>
                                    <div style={{ color: 'var(--text-secondary)', fontSize: '0.75rem', marginTop: '4px' }}>PDF, JPG, PNG up to 4MB</div>
                                </div>
                                <input type="file" ref={fileInputRef} style={{ display: 'none' }} accept=".pdf,.jpg,.jpeg,.png" onChange={handleFileUpload} />
                            </div>

                            <div style={{ marginTop: '24px', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                                {documents.map(doc => (
                                    <div key={doc.id} style={{ 
                                        padding: '12px 16px', 
                                        background: 'rgba(255,255,255,0.03)', 
                                        borderRadius: '16px', 
                                        border: '1px solid rgba(255,255,255,0.05)',
                                        display: 'flex', 
                                        justifyContent: 'space-between', 
                                        alignItems: 'center',
                                        transition: 'all 0.2s'
                                    }}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', minWidth: 0 }}>
                                            <div style={{ width: '36px', height: '36px', borderRadius: '10px', background: 'rgba(255,255,255,0.05)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                                                {doc.fileType.includes('pdf') ? <FileText size={18} color="#EF4444" /> : <Eye size={18} color="#3B82F6" />}
                                            </div>
                                            <div style={{ overflow: 'hidden' }}>
                                                <div style={{ fontSize: '0.85rem', fontWeight: 600, color: 'white', whiteSpace: 'nowrap', textOverflow: 'ellipsis' }}>{doc.name}</div>
                                                <div style={{ fontSize: '0.65rem', color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.02em', marginTop: '2px' }}>{doc.fileType.split('/')[1]}</div>
                                            </div>
                                        </div>
                                        <div style={{ display: 'flex', gap: '6px' }}>
                                            <button type="button" onClick={() => viewDocument(doc)} className="action-btn" title="View"><Eye size={14} /></button>
                                            <button type="button" onClick={() => removeDocument(doc.id)} className="action-btn danger-hover" title="Remove"><Trash2 size={14} /></button>
                                        </div>
                                    </div>
                                ))}
                            </div>
                            
                            {documents.length === 0 && (
                                <div style={{ textAlign: 'center', padding: '40px 0', opacity: 0.3 }}>
                                    <p style={{ fontSize: '0.85rem' }}>No documents in repository.</p>
                                </div>
                            )}
                        </div>

                        {/* STEP 4: SYSTEM CREDENTIALS */}
                        <div style={{ display: step === 4 ? 'block' : 'none' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '8px' }}>
                                <div style={{ background: 'rgba(124, 58, 237, 0.1)', padding: '8px', borderRadius: '10px' }}>
                                    <Key size={20} color="var(--purple-main)" />
                                </div>
                                <div>
                                    <h3 style={{ color: 'white', margin: 0, fontSize: '1.1rem', fontWeight: 700 }}>System Credentials</h3>
                                    <p style={{ color: 'var(--text-secondary)', fontSize: '0.8rem', margin: 0, opacity: 0.7 }}>Configure work identity and access levels.</p>
                                </div>
                            </div>

                            <div style={{ padding: '16px', background: 'rgba(139,92,246,0.05)', borderRadius: '16px', border: '1px solid rgba(139,92,246,0.2)', fontSize: '0.82rem', color: 'var(--purple-light)', margin: '24px 0', display: 'flex', gap: '12px', alignItems: 'center' }}>
                                <div style={{ width: '32px', height: '32px', borderRadius: '50%', background: 'rgba(139,92,246,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                                    <Save size={16} />
                                </div>
                                <div>
                                    <span style={{ fontWeight: 700 }}>Auto-Generated Password:</span> A secure temporary password will be created. You must copy it after provisioning.
                                </div>
                            </div>

                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginTop: '24px' }}>
                                <div style={{ gridColumn: '1 / -1' }}>
                                    <label className="input-label" style={{ fontWeight: 700, textTransform: 'uppercase', fontSize: '0.65rem', letterSpacing: '0.05em' }}>Work Email Address *</label>
                                    <input type="email" name="email" value={formData.email} onChange={handleChange} className="input-field" placeholder="employee@agency.com" style={{ height: '42px', background: 'rgba(0,0,0,0.2)' }} />
                                </div>
                                <div>
                                    <label className="input-label" style={{ fontWeight: 700, textTransform: 'uppercase', fontSize: '0.65rem', letterSpacing: '0.05em' }}>Access Level *</label>
                                    <select name="roleId" value={formData.roleId} onChange={handleChange} className="filter-select" style={{ width: '100%', height: '42px', background: 'rgba(0,0,0,0.2)' }}>
                                        <option value="EMPLOYEE">Standard Employee</option>
                                        <option value="MANAGER">Manager / Team Lead</option>
                                        <option value="ADMIN">System Administrator</option>
                                    </select>
                                </div>
                                <div>
                                    <label className="input-label" style={{ fontWeight: 700, textTransform: 'uppercase', fontSize: '0.65rem', letterSpacing: '0.05em' }}>Account Status *</label>
                                    <select name="status" value={formData.status} onChange={handleChange} className="filter-select" style={{ width: '100%', height: '42px', background: 'rgba(0,0,0,0.2)' }}>
                                        <option value="ACTIVE">Active (Immediate Access)</option>
                                        <option value="INACTIVE">Inactive (Provision Only)</option>
                                    </select>
                                </div>
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
