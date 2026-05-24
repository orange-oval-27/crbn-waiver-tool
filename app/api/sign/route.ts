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
      const test = line ? line + ' ' + word : word;
      if (f.widthOfTextAtSize(test, size) > 512 && line) {
        page.drawText(line, { x: 50, y, size, font: f, color: rgb(0, 0, 0) });
        y -= size + 4;
        line = word;
      } else {
        line = test;
      }
    }
    if (line) {
      page.drawText(line, { x: 50, y, size, font: f, color: rgb(0, 0, 0) });
      y -= size + 4;
    }
  };

  drawLine('CRBN PICKLEBALL - LIABILITY WAIVER', 16, true);
  y -= 8;
  page.drawLine({ start: { x: 50, y }, end: { x: 562, y }, thickness: 1, color: rgb(0, 0, 0) });
  y -= 14;
  drawLine('SIGNER INFORMATION', 11, true);
  y -= 4;
  drawLine('Name: ' + data.first_name + ' ' + data.last_name);
  drawLine('Email: ' + data.email);
  if (data.phone) drawLine('Phone: ' + data.phone);
  drawLine('Date of Birth: ' + data.date_of_birth);
  if (data.guardian_name) drawLine('Parent/Guardian: ' + data.guardian_name);
  if (data.emergency_contact_name) drawLine('Emergency Contact: ' + data.emergency_contact_name + (data.emergency_contact_phone ? ' - ' + data.emergency_contact_phone : ''));
  y -= 8;
  drawLine('WAIVER TERMS', 11, true);
  y -= 4;
  const clauses = [
    '1. ASSUMPTION OF RISK: I acknowledge that pickleball involves inherent risks including physical injury, falls, and collisions. I voluntarily assume all such risks.',
    '2. RELEASE OF LIABILITY: I release CRBN Pickleball, its owners, operators, employees, and agents from all liability, claims, or causes of action arising from my participation.',
    '3. INDEMNIFICATION: I agree to indemnify and hold harmless the Released Parties from any loss or cost they may incur due to my participation.',
    '4. MEDICAL AUTHORIZATION: In an emergency, I authorize the Released Parties to seek medical treatment on my behalf.',
    '5. PHOTO/VIDEO RELEASE: I grant CRBN Pickleball permission to photograph or record me for promotional purposes.',
    '6. GOVERNING LAW: This agreement is governed by applicable state law.',
    '7. ENTIRE AGREEMENT: I have read, understand, and voluntarily sign this waiver.',
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
    const { first_name, last_name, email, phone, date_of_birth, signature_data,
      emergency_contact_name, emergency_contact_phone, guardian_name, guardian_signature_data } = body;

    if (!first_name || !last_name || !email || !date_of_birth || !signature_data) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    const signed_at = new Date().toISOString();

    const { data: waiver, error: dbError } = await supabase
      .from('waivers')
      .insert({
        first_name, last_name, email,
        phone: phone || null,
        date_of_birth, signature_data,
        guardian_name: guardian_name || null,
        guardian_signature_data: guardian_signature_data || null,
        emergency_contact_name: emergency_contact_name || null,
        emergency_contact_phone: emergency_contact_phone || null,
        signed_at,
        status: 'active',
      })
      .select()
      .single();

    if (dbError) {
      console.error('DB error:', dbError);
      return NextResponse.json({ error: 'Failed to save waiver' }, { status: 500 });
    }

    const pdfBytes = await generateWaiverPDF({
      first_name, last_name, email, phone, date_of_birth,
      emergency_contact_name, emergency_contact_phone, guardian_name, signed_at,
    });
    const pdfBase64 = Buffer.from(pdfBytes).toString('base64');

    await resend.emails.send({
      from: 'CRBN Pickleball <waivers@crbnpickleball.com>',
      to: email,
      subject: 'Your CRBN Pickleball Waiver - Signed Copy',
      html: `<div style="font-family:sans-serif;max-width:600px;margin:0 auto"><h2>Waiver Confirmed</h2><p>Hi ${first_name},</p><p>Thank you for signing the CRBN Pickleball Liability Waiver. Your signed copy is attached.</p><p><strong>Signed:</strong> ${new Date(signed_at).toLocaleString()}</p><p>See you on the courts!</p><p style="color:#666;font-size:12px">CRBN Pickleball</p></div>`,
      attachments: [{ filename: `CRBN-Waiver-${first_name}-${last_name}.pdf`, content: pdfBase64 }],
    });

    await resend.emails.send({
      from: 'CRBN Waiver System <waivers@crbnpickleball.com>',
      to: 'kyle@crbnpickleball.com',
      subject: `New Waiver: ${first_name} ${last_name}`,
      html: `<div style="font-family:sans-serif;max-width:600px;margin:0 auto"><h2>New Waiver Signed</h2><table style="width:100%;border-collapse:collapse"><tr><td style="padding:8px;border-bottom:1px solid #eee"><strong>Name</strong></td><td style="padding:8px;border-bottom:1px solid #eee">${first_name} ${last_name}</td></tr><tr><td style="padding:8px;border-bottom:1px solid #eee"><strong>Email</strong></td><td style="padding:8px;border-bottom:1px solid #eee">${email}</td></tr><tr><td style="padding:8px;border-bottom:1px solid #eee"><strong>Phone</strong></td><td style="padding:8px;border-bottom:1px solid #eee">${phone || '-'}</td></tr><tr><td style="padding:8px;border-bottom:1px solid #eee"><strong>DOB</strong></td><td style="padding:8px;border-bottom:1px solid #eee">${date_of_birth}</td></tr><tr><td style="padding:8px;border-bottom:1px solid #eee"><strong>Minor</strong></td><td style="padding:8px;border-bottom:1px solid #eee">${guardian_name ? 'Yes - Guardian: ' + guardian_name : 'No'}</td></tr><tr><td style="padding:8px"><strong>Signed</strong></td><td style="padding:8px">${new Date(signed_at).toLocaleString()}</td></tr></table><p style="margin-top:16px"><a href="https://crbn-waiver-tool.vercel.app/admin" style="background:#000;color:#fff;padding:10px 20px;text-decoration:none;border-radius:6px">View Dashboard</a></p></div>`,
      attachments: [{ filename: `CRBN-Waiver-${first_name}-${last_name}.pdf`, content: pdfBase64 }],
    });

    return NextResponse.json({ success: true, id: waiver.id });
  } catch (error) {
    console.error('Sign API error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
