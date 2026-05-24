import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { Resend } from 'resend';
import { PDFDocument, rgb, StandardFonts } from 'pdf-lib';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_KEY!
);

const resend = new Resend(process.env.RESEND_API_KEY);

async function generateWaiverPDF(data: {
  first_name: string;
  last_name: string;
  email: string;
  phone?: string;
  date_of_birth: string;
  emergency_contact_name?: string;
  emergency_contact_phone?: string;
  guardian_name?: string;
  signed_at: string;
}): Promise<Uint8Array> {
  const pdfDoc = await PDFDocument.create();
  const page = pdfDoc.addPage([612, 792]);
  const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const boldFont = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
  const { height } = page.getSize();
  let y = height - 50;

  const drawLine = (text: string, size = 11, bold = false) => {
    const f = bold ? boldFont : font;
    if (y < 60) { y = height - 50; }
    const words = text.split(' ');
    let line = '';
    for (const word of words) {
      const testLine = line + (line ? ' ' : '') + word;
      const testWidth = f.widthOfTextAtSize(testLine, size);
      if (testWidth > 500 && line) {
        page.drawText(line, { x: 50, y, size, font: f, color: rgb(0, 0, 0) });
        y -= size + 4;
        line = word;
      } else {
        line = testLine;
      }
    }
    if (line) {
      page.drawText(line, { x: 50, y, size, font: f, color: rgb(0, 0, 0) });
      y -= size + 4;
    }
  };

  drawLine('CRBN PICKLEBALL - LIABILITY WAIVER', 14, true);
  y -= 8;
  drawLine(`Signer: ${data.first_name} ${data.last_name}`);
  drawLine(`Email: ${data.email}`);
  if (data.phone) drawLine(`Phone: ${data.phone}`);
  drawLine(`Date of Birth: ${data.date_of_birth}`);
  if (data.emergency_contact_name) drawLine(`Emergency Contact: ${data.emergency_contact_name}${data.emergency_contact_phone ? ' - ' + data.emergency_contact_phone : ''}`);
  if (data.guardian_name) drawLine(`Parent/Guardian: ${data.guardian_name}`);
  y -= 8;

  drawLine('WAIVER AGREEMENT', 12, true);
  y -= 4;

  const clauses = [
    '1. ASSUMPTION OF RISK: I acknowledge that pickleball and related activities involve inherent risks, including but not limited to physical injury, falls, collisions with other players or equipment, and overexertion. I voluntarily assume all such risks.',
    '2. RELEASE OF LIABILITY: I hereby release, waive, discharge, and covenant not to sue CRBN Pickleball, its owners, operators, employees, agents, and volunteers from any and all liability, claims, demands, actions, or causes of action arising out of or related to any loss, damage, or injury that may be sustained while participating in activities at CRBN Pickleball facilities.',
    '3. INDEMNIFICATION: I agree to indemnify and hold harmless CRBN Pickleball from any loss, liability, damage, or costs that may incur due to my participation in activities.',
    '4. MEDICAL AUTHORIZATION: I consent to emergency medical treatment if necessary and agree to be responsible for all medical expenses.',
    '5. RULES COMPLIANCE: I agree to follow all facility rules and safety guidelines.',
  ];

  for (const c of clauses) { drawLine(c, 9); y -= 4; }
  y -= 8;
  page.drawLine({ start: { x: 50, y }, end: { x: 562, y }, thickness: 0.5, color: rgb(0.5, 0.5, 0.5) });
  y -= 12;
  drawLine('Electronically signed by: ' + data.first_name + ' ' + data.last_name);
  drawLine('Date: ' + new Date(data.signed_at).toLocaleString());
  drawLine('This waiver was signed electronically and constitutes a legally binding agreement.', 9);

  return await pdfDoc.save();
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      first_name,
      last_name,
      email,
      phone,
      date_of_birth,
      signature_data,
      emergency_contact_name,
      emergency_contact_phone,
      guardian_name,
      guardian_signature_data,
    } = body;

    if (!first_name || !last_name || !email || !date_of_birth || !signature_data) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    const signed_at = new Date().toISOString();

    // Determine if minor
    const dob = new Date(date_of_birth);
    const today = new Date();
    let age = today.getFullYear() - dob.getFullYear();
    const m = today.getMonth() - dob.getMonth();
    if (m < 0 || (m === 0 && today.getDate() < dob.getDate())) age--;
    const is_minor = age < 18;

    const { data: waiver, error: dbError } = await supabase
      .from('waivers')
      .insert({
        first_name,
        last_name,
        email,
        phone: phone || null,
        date_of_birth,
        signature_data,
        emergency_contact_name: emergency_contact_name || null,
        emergency_contact_phone: emergency_contact_phone || null,
        guardian_name: guardian_name || null,
        guardian_signature: guardian_signature_data || null,
        signed_at,
        is_minor,
        status: 'active',
      })
      .select()
      .single();

    if (dbError) {
      console.error('DB error:', dbError);
      return NextResponse.json({ error: 'Failed to save waiver' }, { status: 500 });
    }

    // Generate PDF
    let pdfBytes: Uint8Array | null = null;
    try {
      pdfBytes = await generateWaiverPDF({
        first_name,
        last_name,
        email,
        phone,
        date_of_birth,
        emergency_contact_name,
        emergency_contact_phone,
        guardian_name,
        signed_at,
      });
    } catch (pdfErr) {
      console.error('PDF generation error:', pdfErr);
    }

    const pdfBase64 = pdfBytes ? Buffer.from(pdfBytes).toString('base64') : null;

    // Send confirmation email to signer
    try {
      const attachments = pdfBase64
        ? [{ filename: 'CRBN-Waiver.pdf', content: pdfBase64 }]
        : [];
      await resend.emails.send({
        from: 'CRBN Pickleball <noreply@crbnpickleball.com>',
        to: email,
        subject: 'Your CRBN Pickleball Waiver Confirmation',
        html: `<h2>Thank you, ${first_name}!</h2><p>Your liability waiver has been signed and recorded. A copy is attached to this email for your records.</p><p>See you on the courts!</p><p>— CRBN Pickleball Team</p>`,
        attachments,
      });
    } catch (emailErr) {
      console.error('Signer email error:', emailErr);
    }

    // Send admin notification
    try {
      await resend.emails.send({
        from: 'CRBN Waiver System <noreply@crbnpickleball.com>',
        to: process.env.ADMIN_EMAILS || 'kyle@crbnpickleball.com',
        subject: `New Waiver Signed: ${first_name} ${last_name}`,
        html: `<h2>New Waiver Signed</h2><ul><li><strong>Name:</strong> ${first_name} ${last_name}</li><li><strong>Email:</strong> ${email}</li><li><strong>Phone:</strong> ${phone || 'N/A'}</li><li><strong>DOB:</strong> ${date_of_birth}</li><li><strong>Minor:</strong> ${is_minor ? 'Yes' : 'No'}</li>${guardian_name ? `<li><strong>Guardian:</strong> ${guardian_name}</li>` : ''}<li><strong>Signed At:</strong> ${new Date(signed_at).toLocaleString()}</li></ul>`,
      });
    } catch (adminEmailErr) {
      console.error('Admin email error:', adminEmailErr);
    }

    return NextResponse.json({ success: true, id: waiver.id });
  } catch (err) {
    console.error('Unexpected error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
