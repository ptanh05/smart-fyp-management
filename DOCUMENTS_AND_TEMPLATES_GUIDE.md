# Documents and Templates Guide

## Overview

This guide explains the document upload system and template management in the project.

---

## 📄 Document Upload (Students)

### Who Uploads Documents?
**Students** upload their project documents after supervisor is accepted.

### Document Types:
1. **Scope Document** - Initial project scope
2. **SRS Document** - Software Requirements Specification  
3. **SDD Document** - Software Design Document
4. **Final Report Document** - Final project report
5. **Presentation Document** - Presentation slides

### How to Upload:
1. **Prerequisites**: 
   - Must have an accepted group
   - Must have an accepted supervisor
   
2. **Steps**:
   - Go to Student Dashboard → **Documents** tab
   - Select document type from dropdown
   - Click "Choose File" and select your document
   - File uploads automatically
   - Status shows as "pending"

3. **Document Status Flow**:
   ```
   pending → accepted_by_student → accepted/rejected
   ```

4. **Who Can Review**:
   - **Supervisor**: Can accept/reject documents
   - **Committee Member**: Can accept/reject documents
   - **Student**: Can set status to "accepted_by_student"

---

## 📋 Template Upload (Committee Members)

### Who Uploads Templates?
**Committee Members** upload document templates that students can download and use as guidelines.

### Template Types:
1. **Scope Document Template** - Template for scope documents
2. **SRS Template** - Template for SRS documents
3. **SDD Template** - Template for SDD documents
4. **Final Report Template** - Template for final reports

### How to Upload Templates:
1. **Steps**:
   - Log in as Committee Member
   - Go to Committee Member Dashboard → **Templates** tab
   - Select template type (Scope, SRS, SDD, Final Report)
   - Select semester (Semester 6, 7, or 8)
   - Click "Choose File" and select template file
   - File uploads automatically

2. **Template Management**:
   - Templates are organized by type and semester
   - Multiple templates can be uploaded per type/semester
   - Students can download templates for reference

### How Students Access Templates:
- Templates are available for download (implementation needed)
- Students should check with committee members for template availability

---

## 🔧 Technical Details

### Document Upload API:
- **Endpoint**: `POST /app/proposal-document/{document_type}/`
- **Requires**: Active SupervisorOfStudentGroup with status="accepted"
- **File Upload**: FormData with `title` and `uploaded_file`

### Template Upload API:
- **Endpoint**: `POST /app/srs_template/{template_type}/`
- **Requires**: Committee Member authentication
- **File Upload**: FormData with `title`, `uploaded_file`, and `semester`

### Document Download:
- **Endpoint**: `GET /app/documents/{filename}/`
- **Access**: Available to authenticated users

### Template Download:
- **Endpoint**: `GET /app/doc_templates/{filename}/`
- **Access**: Available to authenticated users

---

## 🐛 Troubleshooting

### Documents Tab Not Showing Content?
1. Check if supervisor is accepted:
   - Go to Supervisor tab
   - Verify status is "accepted"
   
2. Check browser console (F12):
   - Look for "Documents tab - Supervisor requests:" log
   - Check for any error messages

3. Verify group status:
   - Must have accepted group (groupmate_id exists)
   - Must have accepted supervisor

### Chat Tab Not Working?
1. Check supervisor acceptance status
2. Check browser console for errors
3. Verify groupId is being passed correctly

### Templates Not Uploading?
1. Verify you're logged in as Committee Member
2. Check semester is selected
3. Check file format and size
4. Check browser console for errors

---

## 📊 Status Indicators

### Document Status:
- 🟡 **pending** - Waiting for review
- 🟢 **accepted** - Approved by supervisor/committee
- 🔴 **rejected** - Needs revision
- ⚪ **accepted_by_student** - Student confirmed

### Supervisor Status:
- 🟡 **pending** - Request sent, waiting for response
- 🟢 **accepted** - Supervisor accepted (Documents/Chat available)
- 🔴 **rejected** - Request rejected

---

## ✅ Checklist

### For Students:
- [ ] Group formed and accepted
- [ ] Supervisor requested
- [ ] Supervisor accepted
- [ ] Documents tab accessible
- [ ] Chat tab accessible
- [ ] Upload documents successfully
- [ ] View document status

### For Committee Members:
- [ ] Logged in as Committee Member
- [ ] Templates tab accessible
- [ ] Select template type
- [ ] Select semester
- [ ] Upload template successfully
- [ ] View uploaded templates
- [ ] Templates downloadable

---

## 🎯 Next Steps After Setup

1. **Committee Members**: Upload templates for each semester
2. **Students**: Download templates (if download feature is implemented)
3. **Students**: Upload documents following templates
4. **Supervisors**: Review and evaluate documents
5. **Committee Members**: Evaluate projects
