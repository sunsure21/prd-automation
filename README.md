# PRD 자동 생성 AI 에이전트 🚀

> **최신 LLM과 실시간 검색을 활용한 차세대 PRD 자동 생성 도구**

AI 기반으로 제품 요구사항 문서(PRD)를 자동 생성하는 웹 애플리케이션입니다. 사용자의 아이디어를 입력받아 GPT-4.1과 Claude 3.7 Sonnet을 활용해 완전한 PRD를 생성합니다.

## ✨ 주요 특징

- **🔍 실시간 AI 트렌드 검색**: 최신 3개월 AI 기술 동향을 실시간으로 반영
- **🧠 2단계 AI 분석**: GPT-4.1 분석 → Claude 3.7 Sonnet PRD 생성
- **📊 공식 소스 우선**: OpenAI, Anthropic, Google 등 공식 사이트 우선 검색
- **💾 PRD 관리**: 저장, 편집, 버전 관리 기능
- **📋 복사 기능**: 생성된 PRD 원클릭 복사
- **🎨 모던 UI**: Material Design 기반 전문적인 인터페이스

## 🛠 기술 스택

- **Frontend**: HTML5, CSS3, JavaScript (ES6+), Material Design Components
- **Backend**: Node.js, Express.js
- **AI Models**: GPT-4.1, Claude 3.7 Sonnet (백업: GPT-4o)
- **Search**: Tavily API (실시간 웹 검색)
- **Storage**: 로컬 파일 시스템 (추후 GCP Firestore 연동 예정)

## 🚀 배포 링크

🌐 **Live Demo**: [PRD 자동 생성 도구](https://your-vercel-domain.vercel.app)

## 📦 로컬 설치

### 1. 저장소 클론
```bash
git clone https://github.com/your-username/prd-automation.git
cd prd-automation
```

### 2. 의존성 설치
```bash
npm install
```

### 3. 환경 변수 설정
`.env` 파일을 생성하고 다음 API 키들을 설정하세요:

```env
# OpenAI API 키 (필수) - https://platform.openai.com
OPENAI_API_KEY=sk-proj-your-actual-openai-key-here

# Anthropic Claude API 키 (필수) - https://console.anthropic.com
ANTHROPIC_API_KEY=sk-ant-your-actual-anthropic-key-here

# Tavily 검색 API 키 (필수) - https://tavily.com
TAVILY_API_KEY=tvly-your-actual-tavily-key-here

# Google Gemini API 키 (선택) - https://ai.google.dev
GEMINI_API_KEY=your-actual-gemini-key-here

# GCP 설정 (선택)
GCP_PROJECT_ID=your-project-id
GCP_KEY_FILE=./gcp-key.json

# 서버 설정
PORT=3000
NODE_ENV=development
```

### 4. 서버 시작
```bash
npm start
```

서버가 `http://localhost:3000`에서 실행됩니다.

## 🔧 API 키 발급 방법

### OpenAI API 키
1. [OpenAI Platform](https://platform.openai.com) 접속
2. API Keys 섹션에서 새 키 생성
3. 결제 정보 등록 (사용량에 따라 과금)

### Anthropic Claude API 키
1. [Anthropic Console](https://console.anthropic.com) 접속
2. API Keys에서 새 키 생성
3. 크레딧 충전

### Tavily 검색 API 키
1. [Tavily](https://tavily.com) 가입
2. API 키 발급 (무료 플랜 이용 가능)

## 🎯 사용 방법

1. **아이디어 입력**: 생성하고 싶은 제품/서비스 아이디어를 텍스트박스에 입력
2. **PRD 생성**: "PRD 생성하기" 버튼 클릭
3. **실시간 분석**: AI가 최신 트렌드를 검색하며 분석 진행
4. **결과 확인**: 완성된 PRD 검토 및 복사
5. **저장/편집**: 필요시 PRD 저장 및 버전 관리

## 📁 프로젝트 구조

```
prd-automation/
├── server.js          # Express 서버 및 AI API 로직
├── index.html         # 메인 웹페이지
├── script.js          # 프론트엔드 JavaScript
├── styles.css         # CSS 스타일링
├── package.json       # npm 설정
├── .gitignore         # Git 제외 파일
├── README.md          # 프로젝트 문서
└── docs/              # 추가 문서
    ├── SEARCH_SETUP.md
    └── GCP_SETUP.md
```

## 🔄 개발 상태

- ✅ **기본 PRD 생성**: GPT-4.1 + Claude 3.7 Sonnet
- ✅ **실시간 검색**: Tavily API 연동
- ✅ **PRD 관리**: 저장, 편집, 버전 관리
- ✅ **공식 소스 우선**: OpenAI, Anthropic, Google 우선 검색
- ✅ **UI/UX 개선**: Material Design 기반
- 🟡 **GCP 연동**: Firestore 데이터베이스 (개발 중)
- 🟡 **사용자 인증**: 로그인 시스템 (예정)

## 🤝 기여

이 프로젝트는 오픈소스입니다. 기여를 환영합니다!

1. Fork the Project
2. Create your Feature Branch (`git checkout -b feature/AmazingFeature`)
3. Commit your Changes (`git commit -m 'Add some AmazingFeature'`)
4. Push to the Branch (`git push origin feature/AmazingFeature`)
5. Open a Pull Request

## 📄 라이센스

이 프로젝트는 MIT 라이센스 하에 배포됩니다. 자세한 내용은 `LICENSE` 파일을 참조하세요.

## 👨‍💻 개발자

**Sunny** - [@sunny_dev](https://github.com/sunny_dev)

## 🙏 감사의 말

- OpenAI GPT-4.1
- Anthropic Claude 3.7 Sonnet  
- Tavily Search API
- Material Design Components
- Vercel (배포 플랫폼)

---

⭐ **이 프로젝트가 도움이 되었다면 스타를 눌러주세요!** 