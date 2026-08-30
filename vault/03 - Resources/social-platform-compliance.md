# Thailand Social Platform Compliance & Safety Knowledge Base

Version: 1.0
Last Updated: 2026-05-12
Applies To:

- Web Social Platform
- Mobile Social App
- Community Platform
- AI-Driven Social Network
- Real-time Chat Platform

---

# 1. Overview

เอกสารนี้ใช้เป็นมาตรฐานสำหรับการออกแบบ พัฒนา และดูแลระบบ Social Platform ในประเทศไทย โดยเน้น:

- Legal Compliance
- User Safety
- AI Safety
- Content Moderation
- Privacy Protection
- Abuse Prevention
- Auditability

ทุกทีมต้องปฏิบัติตามเอกสารนี้:

- Backend Team
- Frontend Team
- AI Team
- Moderator Team
- DevOps Team
- Security Team
- Product Team

---

# 2. Thai Laws Related To Social Platform

## 2.1 Criminal Code Section 287

ห้ามเผยแพร่:

- Pornography
- Explicit Nudity
- Sexual Content
- Public Obscene Media

ความเสี่ยง:

- Criminal liability
- Platform owner liability
- ISP blocking

System Requirements:

- NSFW moderation
- Upload scanning
- Reporting system
- Takedown workflow

---

## 2.2 Computer Crime Act Section 14(4)

ห้ามนำเข้าข้อมูลลามกเข้าสู่ระบบที่ประชาชนเข้าถึงได้

Platform Owner Risk:
หากรู้ว่า content ผิดกฎหมายแต่ไม่ลบ อาจมีความผิดร่วม

Mandatory Features:

- Report button
- Admin moderation
- Emergency takedown
- Abuse monitoring
- Content review queue
- Audit logs

---

## 2.3 PDPA (Personal Data Protection Act)

Personal Data Includes:

- Email
- Phone number
- IP address
- Device fingerprint
- Face image
- User location

Required Features:

- Privacy policy
- Cookie consent
- Consent logging
- Data export
- Data deletion
- Account deletion
- Breach notification

---

# 3. Prohibited Content

## 3.1 Illegal Content

Strictly prohibited:

- Child sexual abuse material
- Revenge porn
- Deepfake nudity
- Gambling promotion
- Drug trading
- Terrorism content
- Scam/fraud
- Malware distribution
- Pirated content

---

## 3.2 NSFW Content

High Risk Content:

- Nudity
- Explicit sex
- Fetish content
- Sexual livestream

Rules:

- Hidden by default
- Age gate required
- No public recommendation
- No trending boost
- No autoplay preview

---

# 4. AI Safety Policy

AI MUST NOT:

- Generate illegal porn
- Generate child nudity
- Generate revenge porn
- Assist criminal activity
- Create phishing/scam content

AI MUST:

- Detect abuse
- Detect nudity
- Detect violence
- Detect self-harm risk
- Detect impersonation

---

# 5. Content Moderation Architecture

## Required Pipeline

```
User Upload
    ↓
Virus Scan
    ↓
Metadata Scan
    ↓
AI Image Moderation
    ↓
OCR Moderation
    ↓
NSFW Classification
    ↓
Risk Scoring
    ↓
Publish / Review Queue
```

---

# 6. Required Moderation Systems

## 6.1 User Reporting

Users must be able to:

- Report post
- Report comment
- Report user
- Report message

Reasons:

- Pornography
- Harassment
- Violence
- Scam
- Fake account
- Hate speech

---

## 6.2 Moderator Dashboard

Must Include:

- Review queue
- Escalation tools
- Emergency takedown
- Ban system
- Audit logs
- Evidence archive

---

# 7. Logging Requirements

Must Log:

- User ID
- IP address
- Device info
- Upload history
- Moderation actions
- Report actions
- Login history

Security:

- Immutable logs
- Time synchronization
- Secure retention

---

# 8. Recommendation Algorithm Safety

Algorithm MUST NOT:

- Promote illegal content
- Boost harmful content
- Recommend explicit porn publicly

Algorithm SHOULD:

- Reduce reach for risky accounts
- Downrank reported content
- Apply trust score
- Apply reputation system

---

# 9. Infrastructure Security

Required:

- HTTPS only
- JWT rotation
- WAF
- DDoS protection
- CDN security
- Signed upload URLs
- Malware scanning
- SQL injection prevention
- XSS protection
- CSRF protection

---

# 10. File Upload Security

All uploads must:

- Validate mime type
- Scan malware
- Remove dangerous metadata
- Detect duplicate illegal content
- Restrict executable files

Blocked Extensions:

- .exe
- .bat
- .cmd
- .scr
- .ps1

---

# 11. Child Safety Policy

Zero tolerance for:

- Child nudity
- Child exploitation
- Child grooming
- Sexualized minors

System Requirements:

- Immediate removal
- Permanent ban
- Evidence preservation
- Escalation workflow

---

# 12. Privacy By Design

Principles:

- Data minimization
- Least privilege
- Default private settings
- Consent-first design

---

# 13. Emergency Response Workflow

Critical Events:

- Viral illegal content
- Data breach
- CSAM detection
- Deepfake attack

Must Support:

- Emergency takedown
- Incident logging
- Evidence archive
- Rapid moderation escalation

---

# 14. Terms & Policies

Platform must publish:

- Terms of Service
- Privacy Policy
- Community Guidelines
- Copyright Policy
- Appeal Policy
- Moderation Policy

---

# 15. Engineering Checklist

Before Production Release:

- [ ] NSFW moderation enabled
- [ ] Report system enabled
- [ ] Audit logs enabled
- [ ] Malware scanning enabled
- [ ] Rate limiting enabled
- [ ] Abuse detection enabled
- [ ] Privacy policy published
- [ ] Terms published
- [ ] Moderator tools tested
- [ ] Emergency takedown tested

---

# 16. High Risk Areas

Highest Legal Risks:

1. Pornography
2. Child exploitation
3. Deepfake nudity
4. Gambling
5. Pirated content
6. Data leaks
7. Public explicit feed
8. AI generated illegal content

---

# 17. Recommended Best Practices

Recommended:

- Human + AI moderation
- Shadow banning
- Reputation scoring
- Safe-search by default
- Incremental rollout
- Abuse monitoring
- Threat intelligence

Avoid:

- Anonymous illegal uploads
- Public NSFW feeds
- Auto-promotion of explicit content
- Unmoderated livestreams

---

# 18. Final Principles

Priority Order:

1. Child Safety
2. Legal Compliance
3. User Privacy
4. Abuse Prevention
5. Platform Security
6. Scalability
7. User Experience

Safety-first architecture is mandatory.