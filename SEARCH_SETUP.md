# 🔍 실시간 검색 기능 설정 가이드

## 개요
PRD 자동 생성 AI가 최신 AI/기술 동향을 실시간으로 검색하여 PRD에 반영할 수 있도록 Tavily Search API를 설정하는 방법입니다.

## Tavily API란?
- **AI/RAG 전용 검색 엔진**: LLM과 AI 워크플로우에 최적화된 검색 API
- **실시간 결과**: 최신 정보를 빠르게 제공
- **무료 플랜**: 월 1,000회 검색 무료 제공
- **구조화된 데이터**: JSON 형태로 AI가 이해하기 쉬운 결과 제공

## 🆕 동적 날짜 및 검색 범위 기능

### **자동 날짜 계산**
- **현재 날짜**: PRD 생성 시점을 기준으로 자동 계산
- **검색 범위**: 최근 3개월 동안의 정보로 제한
- **시간대**: 한국 표준시(KST) 기준 표시
- **동적 업데이트**: 하드코딩된 날짜 없이 항상 최신 범위로 검색

### **검색 범위 예시**
```
현재 날짜: 2025년 7월 26일
검색 범위: 최근 3개월 (2025년 4월 ~ 현재)
검색 쿼리: "AI agent development trends 2025-04-26 to 2025-07-26 latest updates"
```

## 설정 방법

### 1. Tavily API 키 발급
1. https://tavily.com 접속
2. "Get API Key" 클릭하여 무료 계정 생성
3. 대시보드에서 API 키 복사

### 2. 환경 변수 설정
`.env` 파일에 다음 라인 추가:
```
TAVILY_API_KEY=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
```

### 3. 기능 확인
- 서버 시작 로그에서 "Tavily API 키: 설정됨" 확인
- PRD 생성 시 "최근 3개월 최신 AI 동향 검색 중..." 메시지 확인
- 브라우저에서 자동으로 현재 날짜 기준 검색 범위 표시

## 검색 기능이 하는 일

### 🔍 자동 검색 대상
- **GitHub**: 최신 AI 프레임워크 및 라이브러리 동향 (최근 3개월 릴리스)
- **Hugging Face**: 최신 AI 모델 및 도구 업데이트 (최근 3개월)
- **Reddit**: 개발자 커뮤니티 트렌드 및 토론 (최근 3개월)
- **Dev.to & Medium**: 기술 블로그 및 튜토리얼 (최근 3개월)
- **공식 블로그**: OpenAI, Anthropic, Google AI 업데이트 (최근 3개월)

### 📊 검색 결과 활용
1. **분석 단계**: 입력된 아이디어와 관련된 최근 3개월간 기술 동향 검색
2. **PRD 생성**: 검색 결과를 바탕으로 최신 기술 스택과 모범 사례 반영
3. **구현 가이드**: 현재 날짜 기준 최신 API, 프레임워크, 도구 추천

## 🎯 향상된 검색 최적화

### **스마트 검색 쿼리 생성**
시스템이 입력 내용을 분석하여 자동 생성하는 검색 쿼리:

#### **기본 AI/에이전트 검색**
```
- "AI agent development trends [3개월 범위] latest updates"
- "AI agent frameworks LangChain AutoGen CrewAI [3개월 범위] GitHub"
- "Multi-agent systems development [3개월 범위] Hugging Face"
- "Agentic AI trends [3개월 범위] latest research"
```

#### **기술별 특화 검색**
```
- API 개발: "API development best practices [3개월 범위] latest"
- 머신러닝: "Machine learning frameworks [3개월 범위] PyTorch TensorFlow"
- 웹 개발: "Web development frameworks [3개월 범위] React Vue Angular"
- MLOps: "MLOps tools [3개월 범위] latest updates"
```

#### **경쟁사 분석**
```
- "[제품명] competitors alternatives [3개월 범위]"
- "[주요기능] implementation guide [3개월 범위]"
```

### **📅 동적 날짜 처리**
```javascript
// 서버에서 자동 계산
function getDateRangeForSearch() {
    const now = new Date();
    const threeMonthsAgo = new Date();
    threeMonthsAgo.setMonth(threeMonthsAgo.getMonth() - 3);
    
    return {
        currentDate: now.toISOString().split('T')[0],
        startDate: threeMonthsAgo.toISOString().split('T')[0],
        searchPeriod: `${startDate} to ${currentDate}`
    };
}
```

## 무료 플랜 사용량 관리

### 월 1,000회 검색 최적화
- PRD 생성 1회당 평균 3회 검색 수행 (개선됨)
- 월 약 300개 PRD 생성 가능
- 검색 실패 시 기본 프롬프트로 자동 대체

### 사용량 모니터링
```javascript
// 터미널에서 검색 상태 확인 가능
console.log('생성된 검색 쿼리 (3개): [쿼리 목록]');
console.log('실시간 검색 시작: "AI agent trends 2025-04-26 to 2025-07-26"');
console.log('검색 완료: 5개 결과');
```

## 문제 해결

### API 키가 없는 경우
- 검색 기능 자동 비활성화
- 기본 AI 모델만으로 PRD 생성 (기존 방식)
- 터미널에 "Tavily API 키: 설정 안됨 - 검색 기능 비활성화" 메시지 표시

### 검색 실패 시
- 15초 타임아웃 후 자동 대체
- 기본 프롬프트로 PRD 생성 계속
- 오류 로그 터미널에 표시

### 사용량 초과 시
- API 제한 도달 시 검색 기능 일시 중단
- 다음 달 1일 자동 리셋
- 유료 플랜 업그레이드 고려

## 고급 설정

### 검색 대상 도메인 커스터마이징
`server.js`에서 `include_domains` 배열 수정:
```javascript
include_domains: [
    "github.com", 
    "huggingface.co", 
    "reddit.com",
    "dev.to", 
    "medium.com",
    "blog.openai.com",
    "anthropic.com",
    "google.ai"
]
```

### 검색 깊이 조정
- `basic`: 빠른 검색 (1 크레딧)
- `advanced`: 심층 검색 (2 크레딧)

### 검색 범위 조정
`getDateRangeForSearch()` 함수에서 기간 수정:
```javascript
// 3개월 대신 6개월로 변경
threeMonthsAgo.setMonth(threeMonthsAgo.getMonth() - 6);
```

## 결과 예시

검색 기능 활성화 시 PRD에 포함되는 내용:
```
=== 최신 기술 동향 및 업데이트 ===
검색 일시: 2025년 7월 26일
검색 범위: 최근 3개월 (2025-04-26 to 2025-07-26)

📋 핵심 요약: AI 에이전트 개발에서 LangGraph와 Multi-Agent 시스템이 최근 3개월간 주요 트렌드...

🔍 최신 정보 소스:
1. **LangGraph Tutorial: Building Multi-Agent Systems**
   - URL: https://github.com/langchain-ai/langgraph
   - 내용: 최근 3개월간 업데이트된 LangGraph 프레임워크를 활용한 다중 에이전트 시스템 구축 방법...
```

## 💡 동적 검색의 장점

1. **항상 최신성 보장**: 하드코딩된 날짜 없이 자동으로 현재 기준 검색
2. **적절한 검색 범위**: 너무 오래된 정보나 너무 최신 정보만의 편향 방지
3. **시간대 고려**: 한국 시간대 기준으로 정확한 날짜 표시
4. **자동 업데이트**: 매일 검색 범위가 자동으로 롤링 업데이트

이렇게 설정하면 PRD가 **항상 최근 3개월간의 최신 기술 동향**을 반영하게 됩니다! 🚀 