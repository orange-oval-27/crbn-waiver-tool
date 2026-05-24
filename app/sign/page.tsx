'use client';

import { useState, useRef } from 'react';

const WAIVER_TEXT = `CRBN PICKLEBALL - LIABILITY WAIVER AND RELEASE OF LIABILITY

In consideration of being allowed to participate in pickleball activities at CRBN Pickleball facilities, I, the undersigned, hereby agree to the following:

1. ASSUMPTION OF RISK: I acknowledge that pickleball and related activities involve inherent risks, including but not limited to physical injury, falls, collisions with other players or equipment, and overexertion. I voluntarily assume all such risks.

2. RELEASE OF LIABILITY: I hereby release, waive, discharge, and covenant not to sue CRBN Pickleball, its owners, operators, employees, agents, and volunteers (collectively "Released Parties") from any and all liability, claims, demands, actions, or causes of action arising out of or related to any loss, damage, or injury that may be sustained by me in connection with use of the facilities or participation in activities.

3. INDEMNIFICATION: I agree to indemnify and hold harmless the Released Parties from any loss, liability, damage, or cost they may incur due to my participation in activities at CRBN Pickleball.

4. MEDICAL AUTHORIZATION: In the event of an emergency, I authorize the Released Parties to seek medical treatment on my behalf and agree to be responsible for all associated costs.

5. PHOTO/VIDEO RELEASE: I grant CRBN Pickleball permission to photograph or video record me during activities and to use such materials for promotional purposes.

6. GOVERNING LAW: This agreement shall be governed by applicable state law. If any provision is found unenforceable, the remaining provisions shall remain in full effect.

7. ENTIRE AGREEMENT: This document constitutes the entire agreement between the parties. I have read and understand this waiver and sign it voluntarily.`;

function SignaturePad({ onSave }: { onSave: (dataUrl: string) => void }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [hasSig, setHasSig] = useState(false);

  const getPos = (e: React.MouseEvent | React.TouchEvent, canvas: HTMLCanvasElement) => {
    const rect = canvas.getBoundingClientRect();
    if ('touches' in e) {
      return { x: e.touches[0].clientX - rect.left, y: e.touches[0].clientY - rect.top };
    }
    return { x: (e as React.MouseEvent).clientX - rect.left, y: (e as React.MouseEvent).clientY - rect.top };
  };

  const startDraw = (e: React.MouseEvent | React.TouchEvent) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const pos = getPos(e, canvas);
    ctx.beginPath();
    ctx.moveTo(pos.x, pos.y);
    setIsDrawing(true);
  };

  const draw = (e: React.MouseEvent | React.TouchEvent) => {
    if (!isDrawing) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    e.preventDefault();
    const pos = getPos(e, canvas);
    ctx.lineWidth = 2;
    ctx.lineCap = 'round';
    ctx.strokeStyle = '#000';
    ctx.lineTo(pos.x, pos.y);
    ctx.stroke();
    setHasSig(true);
  };

  const stopDraw = () => {
    setIsDrawing(false);
    const canvas = canvasRef.current;
    if (canvas && hasSig) onSave(canvas.toDataURL());
  };

  const clear = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    setHasSig(false);
    onSave('');
  };

  return (
    <div>
      <canvas
        ref={canvasRef}
        width={500}
        height={150}
        className="border-2 border-gray-300 rounded w-full touch-none bg-white cursor-crosshair"
        onMouseDown={startDraw}
        onMouseMove={draw}
        onMouseUp={stopDraw}
        onMouseLeave={stopDraw}
        onTouchStart={startDraw}
        onTouchMove={draw}
        onTouchEnd={stopDraw}
      />
      <button type="button" onClick={clear} className="text-sm text-gray-500 underline mt-1">
        Clear signature
      </button>
    </div>
  );
}

export default function SignPage() {
  const [form, setForm] = useState({
    first_name: '',
    last_name: '',
    email: '',
    phone: '',
    date_of_birth: '',
    emergency_contact_name: '',
    emergency_contact_phone: '',
  });
  const [signature, setSignature] = useState('');
  const [guardianName, setGuardianName] = useState('');
  const [guardianSignature, setGuardianSignature] = useState('');
  const [isMinor, setIsMinor] = useState(false);
  const [agreed, setAgreed] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState('');

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setForm((prev) => ({ ...prev, [name]: value }));
    if (name === 'date_of_birth' && value) {
      const dob = new Date(value);
      const today = new Date();
      let age = today.getFullYear() - dob.getFullYear();
      const m = today.getMonth() - dob.getMonth();
      if (m < 0 || (m === 0 && today.getDate() < dob.getDate())) age--;
      setIsMinor(age < 18);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (!signature) return setError('Please provide your signature.');
    if (!agreed) return setError('Please agree to the waiver terms.');
    if (isMinor && (!guardianName || !guardianSignature)) {
      return setError('A parent/guardian name and signature are required for minors.');
    }
    setSubmitting(true);
    try {
      const res = await fetch('/api/sign', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...form,
          signature_data: signature,
          guardian_name: isMinor ? guardianName : null,
          guardian_signature_data: isMinor ? guardianSignature : null,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Submission failed');
      setSubmitted(true);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Something went wrong. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  if (submitted) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl p-8 max-w-md w-full text-center shadow-xl">
          <div className="text-5xl mb-4">&#x2705;</div>
          <h1 className="text-2xl font-bold mb-2">Waiver Signed!</h1>
          <p className="text-gray-600">Thank you, {form.first_name}! A copy of your signed waiver has been sent to {form.email}.</p>
          <p className="text-gray-500 text-sm mt-4">You are all set to play. Have fun!</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-black py-8 px-4">
      <div className="max-w-2xl mx-auto">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-white tracking-tight">CRBN Pickleball</h1>
          <p className="text-gray-400 mt-1">Liability Waiver</p>
        </div>
        <form onSubmit={handleSubmit} className="bg-white rounded-2xl shadow-xl overflow-hidden">
          <div className="p-6 border-b border-gray-100">
            <h2 className="text-lg font-semibold mb-4">Personal Information</h2>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">First Name *</label>
                <input type="text" name="first_name" required value={form.first_name} onChange={handleChange}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-black" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Last Name *</label>
                <input type="text" name="last_name" required value={form.last_name} onChange={handleChange}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-black" />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4 mt-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Email *</label>
                <input type="email" name="email" required value={form.email} onChange={handleChange}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-black" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Phone</label>
                <input type="tel" name="phone" value={form.phone} onChange={handleChange}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-black" />
              </div>
            </div>
            <div className="mt-4">
              <label className="block text-sm font-medium text-gray-700 mb-1">Date of Birth *</label>
              <input type="date" name="date_of_birth" required value={form.date_of_birth} onChange={handleChange}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-black" />
            </div>
          </div>
          {isMinor && (
            <div className="p-6 border-b border-gray-100 bg-yellow-50">
              <div className="flex items-center gap-2 mb-4">
                <span className="text-yellow-600 font-bold">&#9888;</span>
                <h2 className="text-lg font-semibold text-yellow-800">Parent/Guardian Required</h2>
              </div>
              <p className="text-sm text-yellow-700 mb-4">This participant is under 18. A parent or legal guardian must provide their name and signature.</p>
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-1">Parent/Guardian Full Name *</label>
                <input type="text" required value={guardianName} onChange={(e) => setGuardianName(e.target.value)}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-black"
                  placeholder="Legal guardian full name" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Parent/Guardian Signature *</label>
                <SignaturePad onSave={setGuardianSignature} />
              </div>
            </div>
          )}
          <div className="p-6 border-b border-gray-100">
            <h2 className="text-lg font-semibold mb-4">Emergency Contact</h2>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Name</label>
                <input type="text" name="emergency_contact_name" value={form.emergency_contact_name} onChange={handleChange}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-black" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Phone</label>
                <input type="tel" name="emergency_contact_phone" value={form.emergency_contact_phone} onChange={handleChange}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-black" />
              </div>
            </div>
          </div>
          <div className="p-6 border-b border-gray-100">
            <h2 className="text-lg font-semibold mb-4">Waiver Agreement</h2>
            <div className="bg-gray-50 rounded-lg p-4 h-64 overflow-y-auto text-sm text-gray-700 whitespace-pre-line border border-gray-200">
              {WAIVER_TEXT}
            </div>
            <label className="flex items-start gap-3 mt-4 cursor-pointer">
              <input type="checkbox" checked={agreed} onChange={(e) => setAgreed(e.target.checked)} className="mt-0.5 h-4 w-4 accent-black" />
              <span className="text-sm text-gray-700">I have read, understand, and agree to the terms of this liability waiver. I am signing this voluntarily.</span>
            </label>
          </div>
          <div className="p-6">
            <h2 className="text-lg font-semibold mb-2">Your Signature *</h2>
            <p className="text-sm text-gray-500 mb-3">Draw your signature below</p>
            <SignaturePad onSave={setSignature} />
            {error && (
              <div className="mt-4 bg-red-50 border border-red-200 text-red-700 rounded-lg px-4 py-3 text-sm">{error}</div>
            )}
            <button type="submit" disabled={submitting}
              className="mt-6 w-full bg-black text-white py-3 rounded-xl font-semibold text-lg hover:bg-gray-900 disabled:opacity-50 disabled:cursor-not-allowed transition">
              {submitting ? 'Submitting...' : 'Sign & Submit Waiver'}
            </button>
            <p className="text-xs text-gray-400 text-center mt-3">By submitting, you confirm this is your legal signature.</p>
          </div>
        </form>
      </div>
    </div>
  );
}
