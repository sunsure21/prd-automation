# 📧 Gmail SMTP 이메일 발송 설정 가이드

## 🚀 실제 이메일 발송을 위한 설정

### 1️⃣ Gmail 앱 비밀번호 생성

1. **Google 계정 설정** 이동: https://myaccount.google.com/
2. **보안** → **2단계 인증** 활성화 (필수)
3. **앱 비밀번호** 생성:
   - 앱 선택: **메일**
   - 기기 선택: **기타 (사용자 지정 이름)**
   - 이름 입력: `PRD 자동화 서버`
4. **16자리 앱 비밀번호** 복사 (공백 없이)

### 2️⃣ 환경변수 설정

#### 로컬 개발 (.env 파일):
```bash
GMAIL_USER=wyou@wonderslab.kr
GMAIL_APP_PASSWORD=abcd efgh ijkl mnop
```

#### Vercel 배포 환경:
1. **Vercel Dashboard** → **프로젝트** → **Settings** → **Environment Variables**
2. 다음 변수들 추가:
   - `GMAIL_USER`: `wyou@wonderslab.kr`
   - `GMAIL_APP_PASSWORD`: `생성한 16자리 앱 비밀번호`

### 3️⃣ 테스트

설정 완료 후 상담 신청을 하면:
- ✅ **성공 시**: 실제 이메일 발송 + 백업 파일 저장
- ❌ **실패 시**: 백업 파일만 저장 (기존과 동일)

### 🔍 로그 확인

```bash
# 성공 시
✅ 실제 이메일 발송 성공!
📧 Message ID: <message_id>

# 설정 안됨 시  
⚠️ Gmail 앱 비밀번호가 설정되지 않았습니다.
📁 현재는 파일로만 저장되었습니다.
```

### 🔐 보안 주의사항

1. **앱 비밀번호는 절대 공유하지 마세요**
2. **GitHub에 업로드하지 마세요** (.env는 .gitignore에 포함됨)
3. **필요시 언제든 Google 계정에서 앱 비밀번호를 삭제할 수 있습니다** 