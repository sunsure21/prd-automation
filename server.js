require('dotenv').config({ path: require('path').resolve(__dirname, '.env') });

const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
// 임시 조치: .env 파일에서 키를 읽어오지 못하는 지속적인 문제 해결을 위해 키를 직접 설정합니다.
const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY;
const GOOGLE_API_KEY = process.env.GOOGLE_API_KEY;

const express = require('express');
const path = require('path');
const { v4: uuidv4 } = require('uuid');
const { Firestore } = require('@google-cloud/firestore');
const fs = require('fs');
const dotenv = require('dotenv');
require('dotenv').config({ path: './.env' });
const axios = require('axios');

const app = express();
const port = process.env.PORT || 3000;

// API 키와 같은 주요 설정을 전역 상수로 정의
const GCP_PROJECT_ID = process.env.GCP_PROJECT_ID;
const GCP_KEY_FILE = process.env.GCP_KEY_FILE || './gcp-key.json';

// Tavily 검색 API 키
const TAVILY_API_KEY = process.env.TAVILY_API_KEY;

// AI 에이전트 개발 가이드라인 (사용자 제공)
const AI_AGENT_DEVELOPMENT_GUIDELINES = {
    designPhilosophy: {
        simplicity: "복잡한 에이전트 대신 단순한 워크플로우를 채택. 프롬프트 체이닝, 라우팅, 병렬화 등 예측 및 제어가 가능한 단순한 워크플로우 기반으로 기능 설계",
        singleResponsibility: "각 에이전트는 하나의 명확한 기능만 담당하도록 모듈화. 디버깅을 쉽게 만들고 예기치 않은 오류가 전체 시스템에 영향을 미치는 것을 방지",
        deterministicControl: "AI 완전 자율 구조보다 '오케스트레이터-워커' 패턴 채택. 상위 로직이 명시적으로 다음 단계를 결정하고 기능 단위 워커에게 작업 위임"
    },
    technicalImplementation: {
        llmStability: "LLM의 불안정성 대비. 정규식을 활용한 출력값 검증 및 예외 처리, 폴백 로직 구현 필수",
        contextChaining: "긴 Context는 환각의 원인. 복잡한 작업을 여러 개의 명확한 시스템 프롬프트로 체이닝하여 안정성 향상",
        architectureSeparation: "모델 서빙(CPU/GPU 집약적)과 일반 백엔드 로직(I/O Bound)은 물리적으로 다른 서버에서 운영하여 시스템 안정성 확보"
    },
    humanAiCollaboration: {
        roleDefinition: "AI는 '초안 생성자', 인간은 '최종 결정자' 역할. AI가 창의적 초안을 제안하고 인간이 검토, 수정, 최종 승인하는 협업 루프",
        contextManagement: "효과적인 에이전트를 위한 컨텍스트 큐레이션 및 필터링 메커니즘. 사용자 피드백이나 특정 지침을 필요한 시점에 정확히 제공",
        evaluatorOptimizer: "AI 생성 결과물을 평가 기준에 따라 점수화하고, 기준 미달 시 인간 피드백을 받아 반복 개선하는 루프 설계"
    }
};

// AI 에이전트 개발 가이드라인을 프롬프트용으로 포맷팅하는 함수
function formatGuidelinesForPrompt(guidelines) {
    return `
🔹 **설계 철학: 단순함과 명확성이 핵심**
- ${guidelines.designPhilosophy.simplicity}
- ${guidelines.designPhilosophy.singleResponsibility}
- ${guidelines.designPhilosophy.deterministicControl}

🔹 **기술 구현: 안정성과 확장성**
- ${guidelines.technicalImplementation.llmStability}
- ${guidelines.technicalImplementation.contextChaining}
- ${guidelines.technicalImplementation.architectureSeparation}

🔹 **인간-AI 협업 설계**
- ${guidelines.humanAiCollaboration.roleDefinition}
- ${guidelines.humanAiCollaboration.contextManagement}
- ${guidelines.humanAiCollaboration.evaluatorOptimizer}
    `.trim();
}

// 기업 업무용 AI 에이전트 감지 함수
function isEnterpriseAIAgent(analysis) {
    const text = JSON.stringify(analysis).toLowerCase();
    const enterpriseKeywords = ['업무용', '직원', '기업', '회사', '업무', '비즈니스', '워크플로우', '자동화'];
    const aiKeywords = ['ai', '에이전트', 'agent', '인공지능', 'llm', 'gpt', 'claude'];
    
    const hasEnterpriseKeyword = enterpriseKeywords.some(keyword => text.includes(keyword));
    const hasAiKeyword = aiKeywords.some(keyword => text.includes(keyword));
    
    return hasEnterpriseKeyword && hasAiKeyword;
}

// JSON 파싱을 위한 강력한 정제 함수 (Claude 3.7 Sonnet 특화)
function cleanAndParseJSON(text) {
    try {
        // 1. 기본 정제
        let cleanedText = text.trim();
        
        // 2. 마크다운 백틱 제거 (다양한 형태)
        cleanedText = cleanedText.replace(/```json\s*/gi, '').replace(/```\s*/g, '');
        cleanedText = cleanedText.replace(/`{3,}/g, '');
        
        // 3. JSON 시작과 끝 찾기 (더 정확한 방법)
        const jsonStart = cleanedText.indexOf('{');
        let jsonEnd = -1;
        
        if (jsonStart !== -1) {
            let braceCount = 0;
            for (let i = jsonStart; i < cleanedText.length; i++) {
                if (cleanedText[i] === '{') braceCount++;
                if (cleanedText[i] === '}') {
                    braceCount--;
                    if (braceCount === 0) {
                        jsonEnd = i;
                        break;
                    }
                }
            }
        }
        
        if (jsonStart === -1 || jsonEnd === -1 || jsonEnd <= jsonStart) {
            throw new Error('Valid JSON boundaries not found');
        }
        
        cleanedText = cleanedText.substring(jsonStart, jsonEnd + 1);
        
        // 4. Claude 특화 오류 수정
        // 배열 끝의 콤마 제거
        cleanedText = cleanedText.replace(/,(\s*[\]}])/g, '$1');
        
        // 객체 끝의 콤마 제거  
        cleanedText = cleanedText.replace(/,(\s*})/g, '$1');
        
        // 문자열 내 잘못된 따옴표 처리
        cleanedText = cleanedText.replace(/([{,]\s*[a-zA-Z_][a-zA-Z0-9_]*)\s*:/g, '"$1":');
        
        // 이중 콤마 제거
        cleanedText = cleanedText.replace(/,,+/g, ',');
        
        // 배열 내 추가 콤마 정리
        cleanedText = cleanedText.replace(/,(\s*])/g, '$1');
        
        // 5. JSON 파싱 시도
        const parsed = JSON.parse(cleanedText);
        console.log('JSON 파싱 성공');
        return parsed;
        
    } catch (error) {
        console.error('JSON 정제 및 파싱 실패:', error.message);
        console.error('원본 텍스트 (처음 500자):', text.substring(0, 500));
        
        // cleanedText가 정의되지 않은 경우를 대비
        let debugCleanedText = 'undefined';
        try {
            // cleanedText 재정의 시도
            let tempCleanedText = text.trim();
            tempCleanedText = tempCleanedText.replace(/```json\s*/gi, '').replace(/```\s*/g, '');
            const jsonStart = tempCleanedText.indexOf('{');
            if (jsonStart !== -1) {
                debugCleanedText = tempCleanedText.substring(jsonStart, Math.min(jsonStart + 500, tempCleanedText.length));
            }
        } catch (debugError) {
            debugCleanedText = 'debug error: ' + debugError.message;
        }
        console.error('정제된 텍스트 (처음 500자):', debugCleanedText);
        
        // 다시 시도: 더 간단한 파싱
        try {
            const simpleJsonMatch = text.match(/\{[\s\S]*\}/);
            if (simpleJsonMatch) {
                let simpleJson = simpleJsonMatch[0];
                simpleJson = simpleJson.replace(/,(\s*[}\]])/g, '$1');
                return JSON.parse(simpleJson);
            }
        } catch (retryError) {
            console.error('재시도 파싱도 실패:', retryError.message);
        }
        
        throw new Error(`JSON parsing failed: ${error.message}`);
    }
}

// --- 미들웨어 설정 ---
app.use(express.json({ limit: '5mb' })); // 요청 본문 크기 제한 증가
app.use(express.static(path.join(__dirname)));


// --- GCP Firestore 초기화 ---
let db;
try {
    if (fs.existsSync(GCP_KEY_FILE)) {
        db = new Firestore({
            projectId: GCP_PROJECT_ID,
            keyFilename: GCP_KEY_FILE
        });
        console.log(`GCP Firestore: 키 파일(${GCP_KEY_FILE}) 발견, 연동 준비 완료.`);
    } else {
        console.warn(`[주의] GCP 키 파일(${GCP_KEY_FILE})을 찾을 수 없습니다. PRD 저장/관리 기능이 비활성화됩니다.`);
        console.warn("GCP_SETUP.md 파일을 참고하여 설정을 완료해주세요.");
    }
} catch (e) {
    console.error("Firestore 초기화 오류:", e.message);
    db = null;
}

// --- 라우팅 ---
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

app.post('/api/generate-prd', async (request, response) => {
    try {
        const { idea } = request.body;
        if (!idea) {
            return response.status(400).json({ error: '아이디어를 입력해주세요.' });
        }
        
        const result = await generatePRDWithAI(idea);
        response.json(result);

    } catch (error) {
        console.error('최종 PRD 생성 오류:', error.message);
        response.status(500).json({ error: 'AI PRD 생성 중 서버에서 오류가 발생했습니다.', details: error.message });
    }
});

// AI를 사용하여 PRD 생성 (분석 -> PRD 생성)
async function generatePRDWithAI(inputText) {
    let analysis;
    try {
        // 1단계: 아이디어 분석
        try {
            analysis = await analyzeIdeaWithGPT41(inputText, OPENAI_API_KEY);
            console.log("1단계 분석(주): GPT-4.1 성공");
        } catch (error) {
            console.error("1단계 분석(주) GPT-4.1 실패:", error.message);
            console.log("1단계 분석(백업): GPT-4 시도 중...");
            analysis = await analyzeIdeaWithGPT4(inputText, OPENAI_API_KEY);
            console.log("1단계 분석(백업): GPT-4 성공");
        }

        // 2단계: PRD 생성
        let prd;
        try {
            prd = await generatePRDWithClaude(analysis, ANTHROPIC_API_KEY);
        } catch (error) {
            console.error("2단계 PRD작성(주) Claude 3.7 Sonnet 실패:", error.message);
            console.log("2단계 PRD작성(백업): GPT-4.1 시도 중...");
            prd = await generatePRDWithGPT41(analysis, OPENAI_API_KEY);
        }
        
        // 프론트엔드와의 데이터 구조 일치를 위해 응답을 객체로 감쌈
        return { prd, questions: [] };

    } catch (error) {
        console.error("최종 PRD 생성 오류:", error.message);
        throw new Error("모든 AI 모델의 PRD 생성에 실패했습니다.");
    }
}


// --- PRD 저장 및 관리 API ---

// PRD 저장 (신규) - Firestore 권한 문제 해결 전까지 로컬 파일 저장 사용
app.post('/api/prd/save', async (req, res) => {
    console.log('PRD 저장 요청 수신:', req.body);
    
    try {
        const { title, content, status, tags, originalContent } = req.body;
        console.log('추출된 데이터:', { title, content: !!content, status, tags, originalContent: !!originalContent });
        
        const id = uuidv4();
        
        const newPrd = {
            id,
            title,
            content,
            status: status || 'draft',
            version: 1,
            originalContent: originalContent || null,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
            tags: tags || []
        };
        
        console.log('로컬 파일에 저장할 데이터 준비 완료:', { id, title, status });
        
        // 임시 로컬 저장 (프로덕션에서는 Firestore 사용)
        const prdsDir = './saved-prds';
        if (!fs.existsSync(prdsDir)) {
            fs.mkdirSync(prdsDir, { recursive: true });
        }
        
        const filePath = `${prdsDir}/${id}.json`;
        fs.writeFileSync(filePath, JSON.stringify(newPrd, null, 2));
        console.log('로컬 파일 저장 성공:', filePath);
        
        res.status(201).json(newPrd);
    } catch (error) {
        console.error('PRD 저장 중 에러:', error);
        res.status(500).json({ error: 'PRD 저장 실패', details: error.message });
    }
});

// PRD 업데이트 (기존)
app.put('/api/prd/:id', async (req, res) => {
    if (!db) return res.status(503).json({ error: '데이터베이스가 연결되지 않았습니다.' });
    try {
        const { id } = req.params;
        const { title, content, status, tags } = req.body;
        const docRef = db.collection('prds').doc(id);
        const doc = await docRef.get();

        if (!doc.exists) return res.status(404).json({ error: 'PRD를 찾을 수 없습니다.' });

        const updateData = {
            title,
            content,
            status,
            tags,
            updatedAt: new Date(),
            version: (doc.data().version || 1) + 1,
        };

        await docRef.update(updateData);
        res.status(200).json({ id, ...updateData });
    } catch (error) {
        res.status(500).json({ error: 'PRD 업데이트 실패', details: error.message });
    }
});


// PRD 목록 조회
app.get('/api/prd/list', async (req, res) => {
    try {
        const { status } = req.query;
        const prdsDir = './saved-prds';
        
        if (!fs.existsSync(prdsDir)) {
            return res.json([]);
        }
        
        const files = fs.readdirSync(prdsDir).filter(file => file.endsWith('.json'));
        const prds = files.map(file => {
            const filePath = `${prdsDir}/${file}`;
            const data = JSON.parse(fs.readFileSync(filePath, 'utf8'));
            return data;
        });
        
        // 상태 필터링
        const filteredPrds = status ? prds.filter(prd => prd.status === status) : prds;
        
        // 최근 수정일 순으로 정렬
        filteredPrds.sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt));
        
        res.json(filteredPrds);
    } catch (error) {
        console.error('PRD 목록 조회 에러:', error);
        res.status(500).json({ error: 'PRD 목록 조회 실패', details: error.message });
    }
});

// PRD 단일 조회
app.get('/api/prd/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const filePath = `./saved-prds/${id}.json`;
        
        if (!fs.existsSync(filePath)) {
            return res.status(404).json({ error: 'PRD를 찾을 수 없습니다.' });
        }
        
        const prd = JSON.parse(fs.readFileSync(filePath, 'utf8'));
        res.json(prd);
    } catch (error) {
        console.error('PRD 조회 에러:', error);
        res.status(500).json({ error: 'PRD 조회 실패', details: error.message });
    }
});

// PRD 삭제
app.delete('/api/prd/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const filePath = `./saved-prds/${id}.json`;
        
        if (!fs.existsSync(filePath)) {
            return res.status(404).json({ error: 'PRD를 찾을 수 없습니다.' });
        }
        
        fs.unlinkSync(filePath);
        console.log('PRD 삭제 성공:', id);
        res.json({ message: 'PRD가 성공적으로 삭제되었습니다.' });
    } catch (error) {
        console.error('PRD 삭제 에러:', error);
        res.status(500).json({ error: 'PRD 삭제 실패', details: error.message });
    }
});

// PRD 검색
app.get('/api/prd/search', async (req, res) => {
    if (!db) return res.status(503).json({ error: '데이터베이스가 연결되지 않았습니다.' });
    try {
        const { title, status } = req.query;
        let query = db.collection('prds');

        if (status) {
            query = query.where('status', '==', status);
        }
        
        // Firestore는 부분 문자열 검색(like)을 직접 지원하지 않으므로,
        // 클라이언트에서 가져온 모든 데이터를 필터링하거나, Algolia 같은 전문 검색 엔진 사용을 고려해야 함.
        // 여기서는 Prefix matching (시작 문자열 일치)으로 구현합니다.
        if (title) {
            query = query.where('title', '>=', title).where('title', '<=', title + '\uf8ff');
        }

        const snapshot = await query.orderBy('title').orderBy('updatedAt', 'desc').get();
        const prds = snapshot.docs.map(doc => doc.data());
        res.status(200).json(prds);
    } catch (error) {
        res.status(500).json({ error: 'PRD 검색 실패', details: error.message });
    }
});

// PRD 버전 저장 (새로운 버전으로 복사)
app.post('/api/prd/:id/save-version', async (req, res) => {
    try {
        const { id } = req.params;
        const { versionNote = '' } = req.body;
        
        console.log(`PRD 버전 저장 요청: ID ${id}`);
        
        // 원본 PRD 조회
        const originalFile = path.join('./saved-prds/', `${id}.json`);
        
        if (!fs.existsSync(originalFile)) {
            return res.status(404).json({ error: 'PRD를 찾을 수 없습니다.' });
        }
        
        const originalData = JSON.parse(fs.readFileSync(originalFile, 'utf8'));
        
        // 새 버전 ID 생성
        const newVersionId = uuidv4();
        
        // 기존 버전 정보 확인
        const existingVersions = originalData.versions || [];
        const latestVersion = existingVersions.length > 0 ? 
            Math.max(...existingVersions.map(v => parseFloat(v.version))) : 0;
        const newVersion = (latestVersion + 0.1).toFixed(1);
        
        // 새 버전 데이터 생성
        const versionData = {
            ...originalData,
            id: newVersionId,
            title: `${originalData.title} (v${newVersion})`,
            parentId: id,
            version: newVersion,
            versionNote: versionNote,
            createdAt: new Date().toISOString(),
            status: 'version'
        };
        
        // 새 버전 파일 저장
        const versionFile = path.join('./saved-prds/', `${newVersionId}.json`);
        fs.writeFileSync(versionFile, JSON.stringify(versionData, null, 2));
        
        // 원본 PRD에 버전 정보 추가
        if (!originalData.versions) {
            originalData.versions = [];
        }
        
        originalData.versions.push({
            id: newVersionId,
            version: newVersion,
            versionNote: versionNote,
            createdAt: new Date().toISOString()
        });
        
        // 원본 PRD 업데이트
        fs.writeFileSync(originalFile, JSON.stringify(originalData, null, 2));
        
        console.log(`버전 저장 성공: ${newVersionId} (v${newVersion})`);
        
        res.json({
            success: true,
            versionId: newVersionId,
            version: newVersion,
            message: `버전 ${newVersion}이 저장되었습니다.`
        });
        
    } catch (error) {
        console.error('PRD 버전 저장 실패:', error);
        res.status(500).json({ error: 'PRD 버전 저장에 실패했습니다.' });
    }
});

// --- AI 분석 및 생성 함수 ---

// 동적 날짜 계산 함수
function getDateRangeForSearch() {
    const now = new Date();
    const currentDate = now.toISOString().split('T')[0]; // YYYY-MM-DD
    
    // 최근 3개월 계산
    const threeMonthsAgo = new Date();
    threeMonthsAgo.setMonth(threeMonthsAgo.getMonth() - 3);
    const startDate = threeMonthsAgo.toISOString().split('T')[0];
    
    // 한국 시간대로 표시용
    const koreaTime = now.toLocaleString('ko-KR', { 
        timeZone: 'Asia/Seoul',
        year: 'numeric',
        month: 'long',
        day: 'numeric'
    });
    
    return {
        currentDate,
        startDate,
        koreaTime,
        searchPeriod: `${startDate} to ${currentDate}`
    };
}

// 실시간 검색 함수
async function searchLatestTrends(query, apiKey) {
    if (!apiKey) {
        console.log('Tavily API 키가 설정되지 않음 - 검색 기능 비활성화');
        return null;
    }
    
    try {
        console.log(`실시간 검색 시작: "${query}"`);
        
        const response = await axios.post('https://api.tavily.com/search', {
            api_key: apiKey,
            query: query,
            search_depth: "basic",
            include_answer: true,
            include_raw_content: false,
            max_results: 10,
            include_domains: ["blog.openai.com", "openai.com", "anthropic.com", "blog.anthropic.com", "ai.google.dev", "blog.google", "deepmind.google", "ai.meta.com", "blogs.microsoft.com", "huggingface.co", "github.com"],
            exclude_domains: ["ads.com", "spam.com"]
        }, {
            headers: {
                'Content-Type': 'application/json'
            },
            timeout: 15000
        });
        
        console.log(`검색 완료: ${response.data.results?.length || 0}개 결과`);
        return response.data;
    } catch (error) {
        console.error('Tavily 검색 오류:', error.response?.data || error.message);
        return null;
    }
}

// 검색 결과를 분석에 통합하는 함수 (업데이트)
function integrateSearchResults(searchResults) {
    if (!searchResults || !searchResults.results) {
        return '';
    }
    
    const dateInfo = getDateRangeForSearch();
    
    let searchInsights = '\n\n=== 🔍 실시간 검색 결과 반영 ===\n';
    searchInsights += `검색 일시: ${dateInfo.koreaTime}\n`;
    searchInsights += `검색 범위: 최근 3개월 (${dateInfo.searchPeriod})\n`;
    searchInsights += `검색된 소스: ${searchResults.results.length}개\n\n`;
    
    if (searchResults.answer) {
        searchInsights += `📋 **AI 요약**: ${searchResults.answer}\n\n`;
    }
    
    searchInsights += '📚 **검색된 최신 정보**:\n';
    searchResults.results.forEach((result, index) => {
        searchInsights += `${index + 1}. **${result.title}**\n`;
        searchInsights += `   - 🔗 출처: ${result.url}\n`;
        searchInsights += `   - 📄 내용: ${result.content.substring(0, 300)}...\n`;
        searchInsights += `   - 🏷️ 도메인: ${new URL(result.url).hostname}\n\n`;
    });
    
    searchInsights += '⚠️ **중요**: 위 공식 사이트 검색 결과에서 최신 모델 정보를 추출하여 반영하세요:\n';
    searchInsights += '- OpenAI 공식 블로그에서 발견된 최신 GPT 모델명과 버전 사용\n';
    searchInsights += '- Anthropic 공식 사이트에서 발견된 최신 Claude 모델명과 버전 사용\n';
    searchInsights += '- Google AI 공식 사이트에서 발견된 최신 Gemini 모델명과 버전 사용\n';
    searchInsights += '- Meta AI에서 발견된 최신 Llama 모델 정보 반영\n';
    searchInsights += '- 공식 발표가 확인된 모델만 사용하고, 추측이나 비공식 정보는 제외\n';
    searchInsights += '- 구형 모델명(GPT-4, Claude-3, Gemini-3 등) 절대 사용 금지\n';
    
    return searchInsights;
}

// 검색 결과 메타데이터 추출 함수 (새 함수)
function extractSearchMetadata(searchResults) {
    if (!searchResults || !Array.isArray(searchResults) || searchResults.length === 0) {
        return null;
    }
    
    const sources = [];
    searchResults.forEach(result => {
        if (result && result.results) {
            result.results.forEach(item => {
                sources.push({
                    title: item.title,
                    url: item.url,
                    domain: new URL(item.url).hostname,
                    content_preview: item.content.substring(0, 150) + '...'
                });
            });
        }
    });
    
    return {
        search_timestamp: new Date().toISOString(),
        total_sources: sources.length,
        sources: sources.slice(0, 10), // 최대 10개만
        search_domains: [...new Set(sources.map(s => s.domain))]
    };
}

// 검색 쿼리 생성 함수 (업데이트)
function generateSearchQueries(inputText, analysisResult) {
    const queries = [];
    const dateInfo = getDateRangeForSearch();
    
    // 공식 모델 발표 사이트 우선 검색 (최신성 보장)
    queries.push(`site:blog.openai.com OR site:openai.com GPT model release ${dateInfo.searchPeriod}`);
    queries.push(`site:anthropic.com OR site:blog.anthropic.com Claude model release ${dateInfo.searchPeriod}`);
    queries.push(`site:ai.google.dev OR site:blog.google OR site:deepmind.google Gemini model release ${dateInfo.searchPeriod}`);
    queries.push(`site:ai.meta.com Llama model release ${dateInfo.searchPeriod}`);
    queries.push(`site:blogs.microsoft.com Azure OpenAI model updates ${dateInfo.searchPeriod}`);
    queries.push(`latest AI models ${dateInfo.searchPeriod} official announcement new release version`);
    
    // 기본 AI 동향 검색 (최근 3개월)
    queries.push(`AI agent development trends ${dateInfo.searchPeriod} latest updates`);
    queries.push(`AI frameworks updates ${dateInfo.searchPeriod} GitHub releases`);
    
    // 입력 텍스트 기반 특화 검색
    if (inputText.toLowerCase().includes('ai') || inputText.toLowerCase().includes('agent')) {
        queries.push(`AI agent frameworks LangChain AutoGen CrewAI ${dateInfo.searchPeriod} GitHub`);
        queries.push(`Multi-agent systems development ${dateInfo.searchPeriod} Hugging Face`);
        queries.push(`latest AI development stack 2025 models APIs production ${dateInfo.searchPeriod}`);
    }
    
    if (inputText.toLowerCase().includes('api')) {
        queries.push(`API development best practices ${dateInfo.searchPeriod} latest`);
        queries.push(`REST API GraphQL trends ${dateInfo.searchPeriod}`);
    }
    
    if (inputText.toLowerCase().includes('machine learning') || inputText.toLowerCase().includes('ml')) {
        queries.push(`Machine learning frameworks ${dateInfo.searchPeriod} PyTorch TensorFlow`);
        queries.push(`MLOps tools ${dateInfo.searchPeriod} latest updates`);
    }
    
    if (inputText.toLowerCase().includes('web') || inputText.toLowerCase().includes('frontend')) {
        queries.push(`Web development frameworks ${dateInfo.searchPeriod} React Vue Angular`);
        queries.push(`Frontend technologies ${dateInfo.searchPeriod} latest trends`);
    }
    
    // 분석 결과 기반 검색
    if (analysisResult && analysisResult.주요기능) {
        const mainFeatures = Array.isArray(analysisResult.주요기능) ? 
            analysisResult.주요기능.join(' ') : analysisResult.주요기능;
        queries.push(`${mainFeatures} implementation guide ${dateInfo.searchPeriod}`);
    }
    
    // 제품명 기반 검색 (경쟁사 분석용)
    if (analysisResult && analysisResult.제품명) {
        queries.push(`${analysisResult.제품명} competitors alternatives ${dateInfo.searchPeriod}`);
    }
    
    return queries;
}

// AI 모델 분석 함수 업데이트 (주력: GPT-4.1, 백업: GPT-4o)
async function analyzeIdeaWithGPT41(inputText, apiKey) {
    console.log('GPT-4.1로 아이디어 분석 시작...');
    
    try {
        // 1. 실시간 검색 수행
        const searchQueries = generateSearchQueries(inputText, null);
        console.log(`생성된 검색 쿼리 (${searchQueries.length}개):`, searchQueries.slice(0, 3));
        
        const searchPromises = searchQueries.slice(0, 3).map(query => 
            searchLatestTrends(query, TAVILY_API_KEY)
        );
        
        const searchResults = await Promise.all(searchPromises);
        const validSearchResults = searchResults.filter(result => result !== null);
        const searchInsights = validSearchResults
            .map(result => integrateSearchResults(result))
            .join('\n');
        
        // 검색 메타데이터 추출
        const searchMetadata = extractSearchMetadata(validSearchResults);
        
        const dateInfo = getDateRangeForSearch();
        
        // 2. 향상된 프롬프트에 검색 결과 포함
        const prompt = `${formatGuidelinesForPrompt(AI_AGENT_DEVELOPMENT_GUIDELINES)}

당신은 AI 제품 기획 전문가입니다. 다음 내용을 분석하여 PRD 작성에 필요한 핵심 정보를 추출해주세요.

**🚨 검색 결과 기반 최신 AI 기술 반영 필수사항:**
- 아래 검색 결과에서 발견된 공식 릴리즈 정보의 최신 모델명만 사용하세요
- 검색 결과에 명시적으로 언급된 모델 버전만 사용 (예: 검색에서 "GPT-4o", "Claude 3.5 Sonnet", "Gemini 1.5 Pro" 확인된 경우에만 사용)
- 검색 결과에 없는 모델명은 절대 사용 금지 (예: "GPT-5", "Claude 4", "Gemini 3" 등 존재하지 않는 모델)
- 공식 사이트(OpenAI, Anthropic, Google)에서 확인된 정보만 신뢰
- 불확실한 모델명보다는 검색에서 확인된 안정적인 모델명 사용
- 프레임워크와 배포 도구도 검색 결과에서 확인된 최신 버전만 언급

현재 날짜: ${dateInfo.koreaTime}
검색 범위: 최근 3개월 (${dateInfo.searchPeriod})

입력 내용: "${inputText}"

${searchInsights}

위의 최신 기술 동향과 검색 결과에서 발견된 실제 최신 AI 모델과 기술 정보를 반영하여 다음 JSON 형식으로 응답해주세요:
{
    "제품명": "추출된 제품명",
    "제품설명": "제품에 대한 간단한 설명",
    "주요기능": ["기능1", "기능2", "기능3"],
    "타겟사용자": "주요 사용자층",
    "문제정의": "해결하려는 문제",
    "전략적포지셔닝": "시장에서의 위치",
    "competitiveAnalysis": {
        "참고서비스": {"서비스명": "서비스 설명"},
        "차별화요소": ["차별화 요소1", "차별화 요소2"],
        "시장기회": "시장 기회 설명"
    },
    "technicalApproach": {
        "아키텍처": "기술 아키텍처 설명 (최근 3개월 검색 결과 반영)",
        "데이터처리": "데이터 처리 방법 (최신 모범 사례 적용)",
        "핵심기술": "핵심 기술 스택 (${dateInfo.currentDate} 기준, 위 검색 결과에서 발견된 최신 AI 모델과 프레임워크 반영)",
        "확장성": "확장성 고려사항 (최신 클라우드 네이티브 접근법)"
    },
    ${isEnterpriseAIAgent(null) ? `"implementationDetails": {
        "apiDesign": "API 설계 방법론 (최근 3개월 API 트렌드 반영)",
        "dataSchema": "데이터 스키마 설계 (최신 데이터베이스 동향)",
        "security": "보안 요구사항 (${dateInfo.currentDate} 기준 최신 보안 표준)",
        "integration": "시스템 통합 방법 (최신 통합 패턴)",
        "performance": "성능 최적화 기준 (최신 성능 모니터링 도구)",
        "deployment": "배포 전략 (최신 DevOps/GitOps 트렌드)",
        "monitoring": "모니터링 및 로깅 (최신 관찰가능성 도구 및 플랫폼)"
    }` : `"businessModel": {
        "수익모델": "수익 창출 방법",
        "타겟시장": "목표 시장",
        "시장진출전략": "시장 진출 계획"
    }`}
}

중요: 최근 3개월간의 검색 결과에서 얻은 정보를 적극 활용하여 ${dateInfo.currentDate} 기준의 최신 기술 트렌드와 모범 사례를 반영해주세요. 특히 새로운 프레임워크, 라이브러리, API 업데이트, 개발 방법론 등을 포함해주세요.`;

        const response = await axios.post('https://api.openai.com/v1/chat/completions', {
            model: 'gpt-4.1',
            messages: [
                {
                    role: 'system',
                    content: `당신은 최신 기술 동향에 정통한 AI 제품 기획 전문가입니다. 실시간 검색 결과를 활용하여 최근 3개월간의 최신 정보와 트렌드를 반영한 분석을 제공합니다. 현재 날짜는 ${dateInfo.koreaTime}입니다.`
                },
                {
                    role: 'user',
                    content: prompt
                }
            ],
            temperature: 0.7,
            max_tokens: 3000
        }, {
            headers: {
                'Authorization': `Bearer ${apiKey}`,
                'Content-Type': 'application/json'
            }
        });

        const analysisText = response.data.choices[0].message.content;
        console.log('GPT-4.1 분석 응답 길이:', analysisText.length);
        
        // JSON 파싱
        const cleanedAnalysis = cleanAndParseJSON(analysisText);
        
        // 검색 메타데이터 추가
        if (searchMetadata) {
            cleanedAnalysis._searchMetadata = searchMetadata;
            console.log(`GPT-4.1 분석 파싱 성공 (검색 소스 ${searchMetadata.total_sources}개 반영):`, cleanedAnalysis);
        } else {
            console.log('GPT-4.1 분석 파싱 성공 (검색 없음):', cleanedAnalysis);
        }
        
        return cleanedAnalysis;
        
    } catch (error) {
        console.error('GPT-4.1 분석 오류:', error.response?.data || error.message);
        throw error;
    }
}

// 백업 분석 함수 (GPT-4o)
async function analyzeIdeaWithGPT4(inputText, apiKey) {
    console.log('GPT-4o 백업 분석 시작...');
    
    // 동일한 프롬프트 구조 사용
    const prompt = `${formatGuidelinesForPrompt(AI_AGENT_DEVELOPMENT_GUIDELINES)}

당신은 AI 제품 기획 전문가입니다. 다음 내용을 분석하여 PRD 작성에 필요한 핵심 정보를 추출해주세요.

입력 내용: "${inputText}"

다음 JSON 형식으로 응답해주세요:
{
    "제품명": "추출된 제품명",
    "제품설명": "제품에 대한 간단한 설명",
    "주요기능": ["기능1", "기능2", "기능3"],
    "타겟사용자": "주요 사용자층",
    "문제정의": "해결하려는 문제",
    "전략적포지셔닝": "시장에서의 위치",
    "competitiveAnalysis": {
        "참고서비스": {"서비스명": "서비스 설명"},
        "차별화요소": ["차별화 요소1", "차별화 요소2"],
        "시장기회": "시장 기회 설명"
    },
    "technicalApproach": {
        "아키텍처": "기술 아키텍처 설명",
        "데이터처리": "데이터 처리 방법",
        "핵심기술": "핵심 기술 스택",
        "확장성": "확장성 고려사항"
    }${isEnterpriseAIAgent(inputText) ? ',\n    "implementationDetails": {\n        "아키텍처": "상세 시스템 아키텍처",\n        "데이터처리": "데이터 스키마 및 처리",\n        "핵심기술": "구현에 필요한 기술 스택",\n        "확장성": "성능 및 확장성 요구사항"\n    }' : ''}
}

응답은 반드시 유효한 JSON 형식이어야 하며, 한국어로 작성해주세요.`;

    try {
        const response = await axios.post('https://api.openai.com/v1/chat/completions', {
            model: 'gpt-4o',
            messages: [
                {
                    role: 'system', 
                    content: '당신은 AI 제품 기획 전문가입니다. 제공된 내용을 분석하여 JSON 형식으로 핵심 정보를 추출해주세요.'
                },
                {
                    role: 'user',
                    content: prompt
                }
            ],
            max_tokens: 4000,
            temperature: 0.3,
            response_format: { type: "json_object" }
        }, {
            headers: {
                'Authorization': `Bearer ${apiKey}`,
                'Content-Type': 'application/json'
            }
        });

        const analysis = JSON.parse(response.data.choices[0].message.content);
        console.log('GPT-4o 백업 분석 파싱 성공:', analysis);
        return analysis;
    } catch (error) {
        console.error('GPT-4o 백업 분석 중 오류:', error.response?.data || error.message);
        throw error;
    }
}

// Claude 3.7 Sonnet PRD 생성 함수 (주력)
async function generatePRDWithClaude(analysis, apiKey) {
    console.log('Claude 3.7 Sonnet으로 PRD 생성 시작...');

    const agentGuidelinesText = formatGuidelinesForPrompt(AI_AGENT_DEVELOPMENT_GUIDELINES);
    const isEnterprise = isEnterpriseAIAgent(analysis);
    
    const additionalTechDetails = isEnterprise ? `

**📋 기업 업무용 AI 에이전트이므로 implementationDetails 섹션에 다음을 포함하세요:**
- API 설계 및 엔드포인트 구조
- 데이터 스키마 및 모델 정의
- 보안 요구사항 (인증, 권한, 데이터 암호화)
- 기업 시스템과의 통합 방법 (SSO, 기존 DB 연동 등)
- 성능 기준 및 모니터링 방안
- 배포 전략 및 롤백 계획
- 로깅 및 감사 추적 방법` : `

**💼 비즈니스 모델 섹션을 포함하세요:**
- 수익 모델, 타겟 시장, 시장 진출 전략`;

    const jsonStructure = isEnterprise ? `
{
  "overview": "제품 개요",
  "problem": "문제 정의",
  "goals": {
    "primary": "주요 목표",
    "secondary": "보조 목표"
  },
  "competitiveAnalysis": {
    "referenceServices": {
      "서비스명": "서비스 설명과 강점/약점"
    },
    "differentiators": ["차별화 요소1", "차별화 요소2"],
    "marketGap": "시장 기회 설명"
  },
  "technicalApproach": {
    "recommendedStack": ["기술1", "기술2"],
    "architecture": "아키텍처 설명",
    "integrations": ["통합1", "통합2"],
    "scalability": "확장성 설명"
  },
  "implementationDetails": {
    "apiDesign": "API 설계",
    "dataSchema": "데이터 스키마",
    "security": "보안 방안",
    "integration": "통합 방법",
    "performance": "성능 기준",
    "deployment": "배포 전략",
    "monitoring": "모니터링 방안"
  },
  "features": [
    {
      "title": "기능 제목",
      "priority": "Must-have/Should-have/Could-have",
      "description": "기능 설명"
    }
  ],
  "metrics": {
    "performance": "성능 지표",
    "usage": "사용성 지표",
    "satisfaction": "만족도 지표",
    "business": "비즈니스 지표"
  }
}` : `
{
  "overview": "제품 개요",
  "problem": "문제 정의",
  "goals": {
    "primary": "주요 목표",
    "secondary": "보조 목표"
  },
  "competitiveAnalysis": {
    "referenceServices": {
      "서비스명": "서비스 설명과 강점/약점"
    },
    "differentiators": ["차별화 요소1", "차별화 요소2"],
    "marketGap": "시장 기회 설명"
  },
  "technicalApproach": {
    "recommendedStack": ["기술1", "기술2"],
    "architecture": "아키텍처 설명",
    "integrations": ["통합1", "통합2"],
    "scalability": "확장성 설명"
  },
  "businessModel": {
    "revenueModel": "수익 모델",
    "targetMarket": "타겟 시장",
    "goToMarket": "시장 진출 전략"
  },
  "features": [
    {
      "title": "기능 제목",
      "priority": "Must-have/Should-have/Could-have",
      "description": "기능 설명"
    }
  ],
  "metrics": {
    "performance": "성능 지표",
    "usage": "사용성 지표",
    "satisfaction": "만족도 지표",
    "business": "비즈니스 지표"
  }
}`;

    const promptText = `당신은 최고의 프로덕트 매니저입니다. 제공된 분석 결과를 바탕으로 완전한 PRD(Product Requirements Document)를 생성해주세요.

**중요사항:**
1. 응답은 반드시 유효한 JSON 형식이어야 합니다
2. JSON 키는 영어로, 값은 한국어로 작성하세요
3. 마크다운 백틱으로 감싸지 마세요
4. 배열이나 객체 끝에 불필요한 콤마를 추가하지 마세요
5. 각 문자열은 따옴표로 적절히 감싸주세요
6. JSON 구조를 정확히 따라주세요

**🚨 검색 결과 기반 최신 AI 기술 반영 필수사항:**
- 분석 결과에 포함된 검색 메타데이터에서 발견된 공식 모델명만 사용하세요  
- 검색 도메인(OpenAI, Anthropic, Google 공식 사이트)에서 확인된 모델 버전만 언급
- 검색 결과에 없는 가상의 모델명 절대 금지 (예: "Gemini 3", "Claude 4", "GPT-5" 등)
- 불확실한 정보보다는 검색에서 실제 확인된 안정적인 기술 스택 우선
- 기술스택 섹션에서는 검색 결과로 검증된 최신 정보만 포함
- 추측이나 예상 버전 번호 사용 금지, 검색된 실제 정보만 활용

**AI 에이전트 관련 프로젝트의 경우 다음 가이드라인을 기술적 접근 방법에 반드시 반영하세요:**

${agentGuidelinesText}${additionalTechDetails}

**PRD에 반드시 포함해야 할 핵심 개발 세부사항:**
1. 프롬프트 엔지니어링 전략 (구체적인 프롬프트 체이닝 로직, 출력 검증 방법)
2. 레이아웃 결정 알고리즘 (텍스트 분석 → 레이아웃 매핑 규칙)
3. Material Design 컴포넌트 선택 로직 (콘텐츠 타입별 컴포넌트 매핑)
4. HTML/CSS 생성 엔진 구현 (템플릿 엔진, 반응형 로직, 브라우저 호환성)
5. 하위 도메인 구현 방법 (DNS API, SSL 자동화, 충돌 방지)
6. 실시간 편집 동기화 (충돌 해결, 상태 동기화, 오프라인 처리)
7. 에러 처리 시나리오 (LLM 실패, API 장애, 폴백 전략)
8. 성능 최적화 전략 (캐싱, 병목 해결, 리소스 관리)
9. 테스트 전략 (단위/통합/E2E 테스트 방법)
10. 배포 및 모니터링 상세 방안

**분석 결과:**
${JSON.stringify(analysis, null, 2)}

다음 JSON 형식으로 완전한 PRD를 생성해주세요. JSON 키는 영어로, 값은 한국어로 작성하세요.

특히 technicalApproach 섹션에서는 위 AI 에이전트 가이드라인을 적극적으로 반영하여 구체적인 아키텍처와 구현 방안을 제시해주세요:

${jsonStructure}`;

    console.log("Claude 프롬프트 길이:", promptText.length);
    console.log("Claude 프롬프트 샘플:", promptText.substring(0, 300) + "...");

    try {
        const response = await axios.post('https://api.anthropic.com/v1/messages', {
            model: 'claude-3-7-sonnet-20250219',  // 최신 Claude 3.7 Sonnet 모델
            max_tokens: 8000,
            temperature: 0.3,
            system: "당신은 최고의 프로덕트 매니저입니다. 반드시 유효한 JSON 형식으로만 응답하고, 마크다운 백틱을 사용하지 마세요.",
            messages: [
                {
                    role: 'user',
                    content: promptText
                }
            ]
        }, {
            headers: {
                'x-api-key': apiKey,
                'anthropic-version': '2023-06-01',
                'content-type': 'application/json'
            }
        });

        console.log(`Claude 원본 응답 타입: ${typeof response.data.content[0].text}`);
        console.log(`Claude 원본 응답 (처음 300자): ${response.data.content[0].text.substring(0, 300)}`);

        const cleanedContent = cleanAndParseJSON(response.data.content[0].text);
        
        if (!cleanedContent.overview || !cleanedContent.features) {
            throw new Error('PRD 구조가 올바르지 않습니다.');
        }

        // 검색 출처 정보 추가
        if (analysis._searchMetadata) {
            cleanedContent._searchSources = {
                generated_at: analysis._searchMetadata.search_timestamp,
                total_sources: analysis._searchMetadata.total_sources,
                domains_searched: analysis._searchMetadata.search_domains,
                key_sources: analysis._searchMetadata.sources.slice(0, 5).map(source => ({
                    title: source.title,
                    url: source.url,
                    domain: source.domain
                }))
            };
            console.log(`Claude 3.7 Sonnet PRD 파싱 성공 (검색 출처 ${analysis._searchMetadata.total_sources}개 포함)`);
        } else {
            console.log('Claude 3.7 Sonnet PRD 파싱 성공 (검색 없음)');
        }

        return { prd: cleanedContent, questions: [] };
    } catch (error) {
        console.error('Claude API 호출 오류:', error.response?.data || error.message);
        throw new Error(`Claude 3.7 Sonnet PRD 생성 실패: ${error.message}`);
    }
}

// GPT-4.1 PRD 생성 함수 (백업)
async function generatePRDWithGPT41(analysis, apiKey) {
    console.log('GPT-4.1 백업으로 PRD 생성 시작...');

    const agentGuidelinesText = formatGuidelinesForPrompt(AI_AGENT_DEVELOPMENT_GUIDELINES);
    const isEnterprise = isEnterpriseAIAgent(analysis);
    
    const additionalTechDetails = isEnterprise ? `

**📋 기업 업무용 AI 에이전트이므로 implementationDetails 섹션에 다음을 포함하세요:**
- API 설계 및 엔드포인트 구조
- 데이터 스키마 및 모델 정의
- 보안 요구사항 (인증, 권한, 데이터 암호화)
- 기업 시스템과의 통합 방법 (SSO, 기존 DB 연동 등)
- 성능 기준 및 모니터링 방안
- 배포 전략 및 롤백 계획
- 로깅 및 감사 추적 방법` : `

**💼 비즈니스 모델 섹션을 포함하세요:**
- 수익 모델, 타겟 시장, 시장 진출 전략`;

    const jsonStructure = isEnterprise ? `
{
  "overview": "제품 개요",
  "problem": "문제 정의",
  "goals": {
    "primary": "주요 목표",
    "secondary": "보조 목표"
  },
  "competitiveAnalysis": {
    "referenceServices": {
      "서비스명": "서비스 설명과 강점/약점"
    },
    "differentiators": ["차별화 요소1", "차별화 요소2"],
    "marketGap": "시장 기회 설명"
  },
  "technicalApproach": {
    "recommendedStack": ["기술1", "기술2"],
    "architecture": "시스템 아키텍처 설명 (AI 에이전트인 경우 위 가이드라인 반영)",
    "integrations": ["연동1", "연동2"],
    "scalability": "확장성 설명"
  },
  "implementationDetails": {
    "promptEngineering": "프롬프트 엔지니어링 전략 및 체이닝 로직 (단계별 프롬프트 설계, 출력 검증 방법, 폴백 전략)",
    "layoutAlgorithm": "레이아웃 결정 알고리즘 (텍스트 분석 → Material Design 컴포넌트 매핑 규칙, 콘텐츠 타입별 레이아웃 선택 로직)",
    "codeGeneration": "HTML/CSS 생성 엔진 구현 (템플릿 엔진 선택, 반응형 디자인 자동화, 브라우저 호환성 보장 방법)",
    "domainManagement": "하위 도메인 구현 방법 (DNS API 통합, SSL 인증서 자동화, 도메인 충돌 방지 로직)",
    "realtimeSync": "실시간 편집 동기화 (충돌 해결 알고리즘, 상태 동기화 메커니즘, 오프라인 처리 방안)",
    "errorHandling": "에러 처리 시나리오 (LLM API 실패 처리, 서비스 장애 대응, 폴백 전략, 사용자 알림)",
    "apiDesign": "REST API 설계 및 엔드포인트 구조",
    "dataSchema": "데이터 모델 및 스키마 정의",
    "security": "보안 요구사항 (인증, 권한, 암호화)",
    "integration": "기업 시스템과의 통합 방법",
    "performance": "성능 기준 및 모니터링",
    "deployment": "배포 전략 및 롤백 계획",
    "monitoring": "로깅 및 감사 추적"
  },
  "features": [
    {
      "title": "기능명",
      "priority": "Must-have/Should-have/Could-have",
      "description": "기능 설명"
    }
  ],
  "metrics": {
    "performance": "성능 지표",
    "usage": "사용 지표",
    "satisfaction": "만족도 지표",
    "business": "비즈니스 지표"
  }
}` : `
{
  "overview": "제품 개요",
  "problem": "문제 정의",
  "goals": {
    "primary": "주요 목표",
    "secondary": "보조 목표"
  },
  "competitiveAnalysis": {
    "referenceServices": {
      "서비스명": "서비스 설명과 강점/약점"
    },
    "differentiators": ["차별화 요소1", "차별화 요소2"],
    "marketGap": "시장 기회 설명"
  },
  "technicalApproach": {
    "recommendedStack": ["기술1", "기술2"],
    "architecture": "시스템 아키텍처 설명 (AI 에이전트인 경우 위 가이드라인 반영)",
    "integrations": ["연동1", "연동2"],
    "scalability": "확장성 설명"
  },
  "businessModel": {
    "revenueModel": "수익 모델",
    "targetMarket": "타겟 시장",
    "goToMarket": "시장 진출 전략"
  },
  "features": [
    {
      "title": "기능명",
      "priority": "Must-have/Should-have/Could-have",
      "description": "기능 설명"
    }
  ],
  "metrics": {
    "performance": "성능 지표",
    "usage": "사용 지표",
    "satisfaction": "만족도 지표",
    "business": "비즈니스 지표"
  }
}`;

    const prompt = `당신은 최고의 프로덕트 매니저입니다. 제공된 분석을 바탕으로 완전한 PRD(Product Requirements Document)를 JSON 형식으로 생성해주세요.

**중요: AI 에이전트 관련 프로젝트의 경우 다음 가이드라인을 기술적 접근 방법에 반드시 반영하세요:**

${agentGuidelinesText}${additionalTechDetails}

**분석 결과:**
${JSON.stringify(analysis, null, 2)}

다음 형식으로 완전한 PRD JSON을 생성해주세요. JSON 키는 영어로, 값은 한국어로 작성하세요.

특히 technicalApproach 섹션에서는 위 AI 에이전트 가이드라인을 적극적으로 반영하여 구체적인 아키텍처와 구현 방안을 제시해주세요:

${jsonStructure}`;

    try {
        const response = await axios.post('https://api.openai.com/v1/chat/completions', {
            model: 'gpt-4.1',  // 최신 GPT-4.1 모델
            messages: [
                {
                    role: 'system',
                    content: '당신은 최고의 프로덕트 매니저입니다. 제공된 분석을 바탕으로 완전한 PRD를 JSON 형식으로 생성해주세요.'
                },
                {
                    role: 'user',
                    content: prompt
                }
            ],
            max_tokens: 8000,
            temperature: 0.3,
            response_format: { type: "json_object" }
        }, {
            headers: {
                'Authorization': `Bearer ${apiKey}`,
                'Content-Type': 'application/json'
            }
        });

        const prd = JSON.parse(response.data.choices[0].message.content);
        console.log('GPT-4.1 백업 PRD 파싱 성공');
        return { prd, questions: [] };
    } catch (error) {
        console.error('GPT-4.1 백업 PRD API 호출 오류:', error.response?.data || error.message);
        throw new Error(`GPT-4.1 백업 PRD 생성 실패: ${error.message}`);
    }
}


// 3단계 (스마트 질문): GPT-4.1로 스마트 질문 생성
async function generateSmartQuestions(analysis, originalText, apiKey) {
    console.log("3단계: 스마트 질문 생성 중...");
    if (!apiKey) throw new Error("OPENAI_API_KEY is not defined");
    try {
        const prompt = `주어진 아이디어 분석 결과와 원본 텍스트를 바탕으로, PRD를 완성하는 데 필요한 추가 정보를 얻기 위한 '스마트 질문'을 3개만 생성해주세요.
질문은 다음 규칙을 따라야 합니다:
- 반드시 한국어로 질문해야 합니다.
- 각 질문은 구체적이고 명확해야 합니다.
- 사용자가 '네/아니오'로 답할 수 없는, 개방형 질문이어야 합니다.
- 누락된 핵심 정보(타겟 고객, 문제점, 핵심 기능, 비즈니스 모델 등)를 파악하는 데 중점을 둬야 합니다.
- 최종 결과는 오직 질문 3개가 담긴 JSON 배열 형식이어야 합니다. 예: \`["첫 번째 질문", "두 번째 질문", "세 번째 질문"]\`

**아이디어 분석 결과:**
\`\`\`json
${JSON.stringify(analysis, null, 2)}
\`\`\`

**사용자 원본 입력:**
"""
${originalText}
"""

이제 위 규칙에 따라 스마트 질문 3개를 JSON 배열로 생성해주세요.`;

        const response = await axios.post('https://api.openai.com/v1/chat/completions', {
            model: 'gpt-4.1',
            messages: [{ role: 'user', content: prompt }],
            response_format: { "type": "json_object" },
            temperature: 0.7,
        }, {
            headers: { 'Authorization': `Bearer ${apiKey}` }
        });

        const content = JSON.parse(response.data.choices[0].message.content);
        // The response might be an object with a "questions" key.
        const questions = content.questions || content;
        console.log("스마트 질문 생성 성공:", questions);
        return questions;

    } catch (error) {
        console.error('스마트 질문 생성 API 호출 오류:', error.response ? error.response.data : error.message);
        throw new Error('스마트 질문 생성에 실패했습니다.');
    }
}

// 4단계: 스마트 질문 답변으로 분석 결과 정제
async function refineAnalysisWithAnswers(analysis, answers, apiKey) {
    console.log("스마트 질문 답변으로 분석 결과 정제 중...");
    if (!apiKey) throw new Error("OPENAI_API_KEY is not defined");
    try {
        const prompt = `기존 아이디어 분석 결과와 사용자의 추가 답변을 통합하여, 더 완전하고 정확한 최종 분석 결과를 JSON 형식으로 다시 생성해주세요.
기존 분석 결과의 구조를 유지하고, 사용자의 답변 내용을 관련 항목에 자연스럽게 녹여내어 내용을 풍부하게 만들어야 합니다.
**규칙:**
- **언어: 모든 결과는 반드시 한국어로만 작성해야 합니다. 영어는 절대 사용하지 마세요.**
- **구조: 원래 분석 결과의 JSON 구조를 그대로 유지해야 합니다.**
- **통합: 사용자의 답변이 기존 분석 내용과 자연스럽게 통합되어야 합니다.**

**기존 분석 결과:**
\`\`\`json
${JSON.stringify(analysis, null, 2)}
\`\`\`

**사용자 추가 답변:**
\`\`\`json
${JSON.stringify(answers, null, 2)}
\`\`\`

이제 위 규칙에 따라 최종 분석 결과를 JSON 형식으로 생성해주세요.`;

        const response = await axios.post('https://api.openai.com/v1/chat/completions', {
            model: 'gpt-4.1',
            messages: [{ role: 'user', content: prompt }],
            response_format: { "type": "json_object" },
            temperature: 0.3,
        }, {
            headers: { 'Authorization': `Bearer ${apiKey}` }
        });

        const refinedAnalysis = JSON.parse(response.data.choices[0].message.content);
        console.log("분석 결과 정제 성공:", refinedAnalysis);
        return refinedAnalysis;
    } catch (error) {
        console.error('분석 정제 API 호출 오류:', error.response ? error.response.data : error.message);
        throw new Error('스마트 질문 답변으로 분석 결과를 정제하는 데 실패했습니다.');
    }
}


// --- 서버 시작 ---
app.listen(port, () => {
    console.log(`서버가 http://localhost:${port}에서 실행 중입니다.`);
    console.log("환경 확인:");
    console.log("- OpenAI API 키:", OPENAI_API_KEY ? `설정됨 (키 미리보기: ${OPENAI_API_KEY.substring(0, 10)}...)` : "설정 안됨");
    console.log("- Claude API 키:", ANTHROPIC_API_KEY ? "설정됨" : "설정 안됨");
    console.log("- Gemini API 키:", GOOGLE_API_KEY ? "설정됨" : "설정 안됨");
    console.log("- Tavily API 키:", TAVILY_API_KEY ? "설정됨" : "설정 안됨");
    console.log("- 포트:", port);
    if (db) {
        console.log(`- GCP Firestore: 연동 완료.`);
    } else {
        console.log(`- GCP Firestore: 연동 실패. 키 파일을 확인해주세요.`);
    }
    console.log("AI 모델 구성:");
    console.log('- 1단계 분석: GPT-4.1 (주) → GPT-4o (백업)');
    console.log('- 2단계 PRD작성: Claude 3.7 Sonnet (주) → GPT-4.1 (백업)');
}); 