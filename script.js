document.addEventListener('DOMContentLoaded', () => {
    // --- MDC 컴포넌트 초기화 ---
    // 각 컴포넌트의 인스턴스를 한번만 생성하여 변수에 저장합니다.
    const snackbar = new mdc.snackbar.MDCSnackbar(document.querySelector('.mdc-snackbar'));
    const prdEditDialog = new mdc.dialog.MDCDialog(document.getElementById('prd-edit-dialog'));
    const statusFilter = new mdc.select.MDCSelect(document.getElementById('status-filter-select'));
    const prdStatusSelect = new mdc.select.MDCSelect(document.getElementById('prd-status-select'));

    // 나머지 모든 텍스트 필드를 초기화합니다.
    document.querySelectorAll('.mdc-text-field').forEach(el => new mdc.textField.MDCTextField(el));
    
    // 모든 MDC 버튼 초기화
    document.querySelectorAll('.mdc-button').forEach(el => {
        try {
            new mdc.ripple.MDCRipple(el);
        } catch (error) {
            console.error('MDC 버튼 초기화 오류:', error);
        }
    });

    // 추가 버튼 스타일 적용 (MDC 실패 시 대비)
    setTimeout(() => {
        const buttons = [editBtn, versionSaveBtn, copyAllBtn, resetPrdBtn];
        buttons.forEach(btn => {
            if (btn) {
                btn.style.cursor = 'pointer';
                btn.style.pointerEvents = 'auto';
                console.log('버튼 스타일 적용:', btn.id);
            }
        });
    }, 100);


    // --- UI 요소 ---
    const generateBtn = document.getElementById('generate-btn');
    const ideaInput = document.getElementById('idea-input');
    const loadingModal = document.getElementById('loading-modal');
    const prdContent = document.getElementById('prd-content');
    const resultSection = document.getElementById('result-section');
    const copyAllBtn = document.getElementById('copy-all-btn');
    const editBtn = document.getElementById('edit-btn');
    const versionSaveBtn = document.getElementById('version-save-btn');
    const resetPrdBtn = document.getElementById('reset-prd-btn');
    
    // 버튼 요소 존재 확인
    console.log('버튼 요소 확인:');
    console.log('- copyAllBtn:', copyAllBtn);
    console.log('- editBtn:', editBtn);
    console.log('- versionSaveBtn:', versionSaveBtn);
    console.log('- resetPrdBtn:', resetPrdBtn);
    const prdGenerationView = document.getElementById('prd-generation-view');
    const prdManagementView = document.getElementById('prd-management-view');
    const showManagementBtn = document.getElementById('show-prd-management');
    const prdListContainer = document.getElementById('prd-list');
    const refreshPrdListBtn = document.getElementById('refresh-prd-list');
    const prdSearchInput = document.getElementById('prd-search');

    // --- 상태 변수 ---
    let currentPRD = null;
    let isEditing = false;

    // --- 로컬 스토리지 관리 ---
    function savePRDToSession(prd) {
        try {
            localStorage.setItem('lastGeneratedPRD', JSON.stringify(prd));
            localStorage.setItem('lastGeneratedPRD_timestamp', Date.now().toString());
            
            // 입력창 내용도 함께 저장
            if (ideaInput && ideaInput.value.trim()) {
                localStorage.setItem('lastIdeaInput', ideaInput.value);
                console.log('입력창 내용도 함께 저장됨');
            }
            
            console.log('PRD가 로컬 스토리지에 저장되었습니다.');
        } catch (error) {
            console.error('PRD 저장 오류:', error);
        }
    }

    function loadPRDFromSession() {
        try {
            const savedPRD = localStorage.getItem('lastGeneratedPRD');
            const timestamp = localStorage.getItem('lastGeneratedPRD_timestamp');
            
            if (savedPRD && timestamp) {
                // 24시간 이내 데이터만 복원 (선택적)
                const twentyFourHours = 24 * 60 * 60 * 1000;
                const savedTime = parseInt(timestamp);
                const now = Date.now();
                
                if (now - savedTime < twentyFourHours) {
                    const prd = JSON.parse(savedPRD);
                    console.log('저장된 PRD를 복원합니다:', prd);
                    console.log('저장 시간:', new Date(savedTime).toLocaleString());
                    return prd;
                } else {
                    console.log('저장된 PRD가 24시간이 지나 자동 삭제됩니다.');
                    clearPRDSession();
                }
            }
        } catch (error) {
            console.error('PRD 복원 오류:', error);
        }
        return null;
    }

    function clearPRDSession() {
        try {
            localStorage.removeItem('lastGeneratedPRD');
            localStorage.removeItem('lastGeneratedPRD_timestamp');
            localStorage.removeItem('lastIdeaInput');
            console.log('PRD 로컬 스토리지가 삭제되었습니다.');
        } catch (error) {
            console.error('PRD 삭제 오류:', error);
        }
    }
    
    // --- 유틸리티 함수 ---
    function showNotification(message, type = 'normal') {
        try {
            const label = snackbar.root.querySelector('.mdc-snackbar__label');
            label.textContent = message;
            snackbar.open();
        } catch (error) {
            console.error('Snackbar 오류:', error);
            // 폴백으로 alert 사용
            alert(message);
        }
    }

    function debounce(func, wait) {
        let timeout;
        return function executedFunction(...args) {
            const later = () => {
                clearTimeout(timeout);
                func(...args);
            };
            clearTimeout(timeout);
            timeout = setTimeout(later, wait);
        };
    }

    // --- 화면 전환 로직 ---
    function showPRDGeneration() {
        prdManagementView.style.display = 'none';
        prdGenerationView.style.display = 'block';
        const label = showManagementBtn.querySelector('.mdc-button__label');
        if (label) label.textContent = 'PRD 관리';
        showManagementBtn.removeEventListener('click', showPRDGeneration);
        showManagementBtn.addEventListener('click', showPRDManagement);
        
        // 성공 메시지 표시
        showNotification('PRD 생성 화면으로 돌아왔습니다.');
    }

    function showPRDManagement() {
        prdGenerationView.style.display = 'none';
        prdManagementView.style.display = 'block';
        const label = showManagementBtn.querySelector('.mdc-button__label');
        if (label) label.textContent = '← PRD 생성';
        showManagementBtn.removeEventListener('click', showPRDManagement);
        showManagementBtn.addEventListener('click', showPRDGeneration);
        loadPRDList();
        
        // 안내 메시지 표시
        showNotification('PRD 관리 화면입니다. 우상단 "← PRD 생성" 버튼으로 돌아갈 수 있습니다.');
    }

    // --- PRD 생성 로직 ---
    generateBtn.addEventListener('click', async () => {
        const inputText = ideaInput.value.trim();
        if (!inputText) {
            showNotification('아이디어를 입력해주세요.', 'error');
            return;
        }

        loadingModal.style.display = 'flex';
        resultSection.style.display = 'none';
        prdContent.innerHTML = '';
        currentPRD = null;
        
        // 새로운 PRD 생성 시 기존 세션 클리어 (입력창 내용은 미리 저장)
        localStorage.setItem('lastIdeaInput', inputText);
        clearPRDSession();

        try {
            const response = await fetch('/api/generate-prd', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ idea: inputText })
            });

            const data = await response.json();
            console.log('🔄 API 응답 받음:', data);

            if (response.ok) {
                console.log('✅ API 응답 성공, 전체 데이터:', data);
                console.log('📋 PRD 구조 확인:', data.prd);
                
                // PRD 데이터 구조 확인 및 정규화
                let actualPRD;
                if (data.prd && data.prd.prd) {
                    // 중첩된 구조인 경우: {prd: {prd: {...}, questions: []}}
                    actualPRD = data.prd.prd;
                    console.log('🔄 중첩된 PRD 구조 감지, 내부 PRD 사용:', actualPRD);
                } else if (data.prd) {
                    // 직접 구조인 경우: {prd: {...}}
                    actualPRD = data.prd;
                    console.log('📋 직접 PRD 구조 사용:', actualPRD);
                } else {
                    console.error('❌ PRD 데이터를 찾을 수 없습니다:', data);
                    showNotification('PRD 데이터 구조 오류가 발생했습니다.', 'error');
                    return;
                }
                
                if (data.questions && data.questions.length > 0) {
                    console.log('📝 질문 있음:', data.questions);
                    displayPRD(actualPRD);
                } else {
                    console.log('📋 PRD 바로 표시');
                    displayPRD(actualPRD);
                }
            } else {
                console.error('❌ API 응답 오류:', data);
                showNotification(`오류: ${data.error} (세부 정보: ${data.details || '없음'})`, 'error');
            }
        } catch (error) {
            console.error('PRD 생성 오류:', error);
            showNotification('PRD 생성 중 심각한 오류가 발생했습니다.', 'error');
        } finally {
            loadingModal.style.display = 'none';
        }
    });

    function displayPRD(prd) {
        console.log('🎯 displayPRD 함수 호출됨, PRD 데이터:', prd);
        
        currentPRD = prd; 
        isEditing = false;
        
        // PRD를 localStorage에 저장 (페이지 새로고침 시 복원용)
        savePRDToSession(prd);
        
        console.log('📝 prdContent 요소:', prdContent);
        console.log('📋 resultSection 요소:', resultSection);
        
        prdContent.innerHTML = '';

        const sections = [
            { id: 'overview', title: '제품 개요', content: prd.overview },
            { id: 'problem', title: '문제 정의', content: prd.problem },
            { id: 'goals', title: '목표', content: prd.goals },
            { id: 'competitiveAnalysis', title: '경쟁사 분석', content: prd.competitiveAnalysis },
            { id: 'technicalApproach', title: '기술적 접근', content: prd.technicalApproach },
            // 업무용 AI 에이전트는 구현 세부사항만 표시 (비즈니스 모델 제외)
            { id: 'implementationDetails', title: '구현 세부사항', content: prd.implementationDetails },
            { id: 'features', title: '핵심 기능', content: prd.features },
            // 검색 출처 정보 (있는 경우에만)
            { id: 'searchSources', title: '🔍 실시간 검색 출처', content: prd._searchSources || prd._searchMetadata },
            // 성공 지표는 업무용에서 제외
            // { id: 'metrics', title: '성공 지표', content: prd.metrics },
        ];

        sections.forEach(section => {
            console.log(`🔍 섹션 처리: ${section.title}`, section.content);
            
            // 내용이 있는 경우에만 섹션 생성 (빈 문자열, null, undefined 체크)
            if (section.content && 
                (typeof section.content === 'string' ? section.content.trim() : true) &&
                !(Array.isArray(section.content) && section.content.length === 0) &&
                !(typeof section.content === 'object' && Object.keys(section.content).length === 0)) {
                
                console.log(`✅ 섹션 '${section.title}' 생성 중...`);
                const sectionElement = createPRDSection(section.title, section.content, section.id);
                prdContent.appendChild(sectionElement);
                console.log(`✅ 섹션 '${section.title}' 추가됨`);
            } else {
                // 빈 섹션에 대한 플레이스홀더 추가 (디버깅용)
                console.log(`❌ 섹션 '${section.title}' 건너뜀: 내용이 비어있음`, section.content);
            }
        });

        console.log('🖥️ PRD 섹션들 생성 완료, 결과 영역 표시 중...');
        
        resultSection.style.display = 'block';
        
        // PRD 생성 완료 후 부드러운 시각적 피드백
        if (!prd.id && !isEditing) {
            console.log('✨ 새 PRD 생성 - 애니메이션 효과 적용');
            
            // 결과 영역에 성공 하이라이트 효과
            resultSection.style.opacity = '0';
            resultSection.style.transform = 'translateY(20px)';
            
            setTimeout(() => {
                resultSection.style.transition = 'all 0.6s ease-out';
                resultSection.style.opacity = '1';
                resultSection.style.transform = 'translateY(0)';
                resultSection.scrollIntoView({ behavior: 'smooth' });
                
                console.log('🎊 PRD 표시 애니메이션 완료');
                
                // 간단한 성공 알림
                showNotification('✨ PRD 생성 완료! 아래에서 결과를 확인하고 "버전저장"으로 저장하세요.');
            }, 100);
            
            // 하이라이트 효과 제거
            setTimeout(() => {
                resultSection.style.transition = '';
            }, 700);
        } else {
            console.log('📋 편집 모드 또는 복원 - 즉시 표시');
            // 편집 모드나 복원 시에는 즉시 표시
            resultSection.scrollIntoView({ behavior: 'smooth' });
        }
    }

    function createPRDSection(title, content, key) {
        const section = document.createElement('div');
        section.className = 'prd-section';

        const header = document.createElement('h3');
        header.textContent = title;
        section.appendChild(header);

        const contentDiv = document.createElement('div');
        contentDiv.className = 'prd-section-content';

        if (key === 'features' && Array.isArray(content)) {
            contentDiv.appendChild(createFeaturesList(content));
        } else if (key === 'searchSources' && content) {
            contentDiv.appendChild(createSearchSourcesSection(content));
        } else {
            contentDiv.innerHTML = formatContent(content);
        }

        section.appendChild(contentDiv);
        return section;
    }

    function createFeaturesList(features) {
        const list = document.createElement('div');
        list.className = 'features-grid';

        features.forEach(feature => {
            const featureCard = document.createElement('div');
            featureCard.className = 'feature-card';

            const priority = document.createElement('div');
            priority.className = 'priority';
            priority.textContent = `[${feature.priority || 'N/A'}]`;
            featureCard.appendChild(priority);
            
            const title = document.createElement('h4');
            title.className = 'title';
            title.textContent = feature.title || 'Untitled Feature';
            featureCard.appendChild(title);

            const description = document.createElement('p');
            description.className = 'description';
            description.textContent = feature.description || 'No description provided.';
            featureCard.appendChild(description);

            list.appendChild(featureCard);
        });

        return list;
    }

    function createSearchSourcesSection(searchSources) {
        console.log('🔍 createSearchSourcesSection 호출됨, 데이터:', searchSources);
        
        const container = document.createElement('div');
        container.className = 'search-sources-container';
        
        // 데이터 구조 정규화 (두 가지 형태 모두 지원)
        const timestamp = searchSources.generated_at || searchSources.search_timestamp;
        const domains = searchSources.domains_searched || searchSources.search_domains || [];
        const sources = searchSources.key_sources || searchSources.sources || [];
        
        console.log('📊 정규화된 데이터:', { timestamp, domains, sources });
        
        // 검색 정보 헤더
        const header = document.createElement('div');
        header.className = 'search-info-header';
        header.innerHTML = `
            <div class="search-stats">
                <span class="search-stat">📊 총 ${searchSources.total_sources || 0}개 소스</span>
                <span class="search-stat">🌐 ${domains.length}개 도메인</span>
                <span class="search-stat">⏰ ${timestamp ? new Date(timestamp).toLocaleString('ko-KR') : '시간 정보 없음'}</span>
            </div>
        `;
        container.appendChild(header);
        
        // 도메인 태그
        if (domains.length > 0) {
            const domainsDiv = document.createElement('div');
            domainsDiv.className = 'search-domains';
            domainsDiv.innerHTML = '<strong>검색된 도메인:</strong> ' + 
                domains.map(domain => 
                    `<span class="domain-tag">${domain}</span>`
                ).join(' ');
            container.appendChild(domainsDiv);
        }
        
        // 주요 검색 출처
        if (sources.length > 0) {
            const sourcesDiv = document.createElement('div');
            sourcesDiv.className = 'search-sources-list';
            sourcesDiv.innerHTML = '<h4>🔗 주요 검색 출처:</h4>';
            
            const sourcesList = document.createElement('ol');
            sourcesList.className = 'sources-list';
            
            sources.slice(0, 10).forEach((source, index) => {
                console.log(`📄 출처 ${index + 1}:`, source);
                
                const li = document.createElement('li');
                li.className = 'source-item';
                
                // 다양한 데이터 구조 지원
                const url = source.url || source.link || '#';
                const title = source.title || source.name || `검색 결과 ${index + 1}`;
                const domain = source.domain || (url !== '#' ? new URL(url).hostname : '알 수 없음');
                
                li.innerHTML = `
                    <div class="source-header">
                        <a href="${url}" target="_blank" rel="noopener noreferrer" class="source-link">
                            <span class="source-title">${title}</span>
                            <span class="external-link-icon">🔗</span>
                        </a>
                        <span class="source-domain">${domain}</span>
                    </div>
                `;
                sourcesList.appendChild(li);
            });
            
            sourcesDiv.appendChild(sourcesList);
            container.appendChild(sourcesDiv);
        }
        
        // 검색 결과 반영 안내
        const notice = document.createElement('div');
        notice.className = 'search-notice';
        notice.innerHTML = `
            <p><strong>💡 이 PRD는 위 출처들의 최신 정보를 분석하여 생성되었습니다.</strong></p>
            <p>최신 AI 기술 동향, 프레임워크 업데이트, 모범 사례가 반영되어 있습니다.</p>
        `;
        container.appendChild(notice);
        
        return container;
    }
    
    function getPriorityClass(priority) {
        const p = priority.toLowerCase();
        if (p.includes('must')) return 'must-have';
        if (p.includes('should')) return 'should-have';
        if (p.includes('could')) return 'could-have';
        return '';
    }

    function formatContent(content) {
        if (typeof content === 'string') {
            return content.replace(/\n/g, '<br>');
        } else if (Array.isArray(content)) {
            return `<ul>${content.map(item => `<li>${formatContent(item)}</li>`).join('')}</ul>`;
        } else if (typeof content === 'object' && content !== null) {
            return `<ul class="object-list">${Object.entries(content).map(([key, value]) => `<li><strong>${key}:</strong> ${formatContent(value)}</li>`).join('')}</ul>`;
        }
        return content;
    }

    // --- PRD 관리 (목록, 수정, 삭제) ---
    async function loadPRDList() {
        const status = statusFilter.value;
        const searchTerm = prdSearchInput.value.trim();
        let url;
        
        if(searchTerm) {
            url = `/api/prd/search?title=${encodeURIComponent(searchTerm)}`;
            if(status) url += `&status=${status}`;
        } else {
            url = `/api/prd/list?status=${status}`;
        }

        try {
            const response = await fetch(url);
            if (!response.ok) throw new Error('PRD 목록 로딩 실패');
            const prds = await response.json();
            displayPRDList(prds);
        } catch (error) {
            console.error(error);
            showNotification('PRD 목록을 불러오는 데 실패했습니다.', 'error');
            prdListContainer.innerHTML = '<p class="empty-list-message">PRD를 불러오는 데 실패했습니다.</p>';
        }
    }

    function displayPRDList(prds) {
        prdListContainer.innerHTML = '';
        if (!prds || prds.length === 0) {
            prdListContainer.innerHTML = '<p class="empty-list-message">저장된 PRD가 없습니다. 새로운 PRD를 생성하고 저장해보세요.</p>';
            return;
        }
        prds.forEach(prd => prdListContainer.appendChild(createPRDCard(prd)));
        setupPRDCardListeners();
    }
    
    function createPRDCard(prd) {
        const card = document.createElement('div');
        card.className = 'prd-card';
        card.setAttribute('data-prd-id', prd.id); // 데이터 속성 추가
        card.innerHTML = `
            <div class="prd-card-header">
                <h3 class="prd-card-title">${prd.title}</h3>
                <div class="prd-card-actions">
                    <button class="action-btn view-btn" data-prd-id="${prd.id}">
                        <i class="material-icons">visibility</i>
                        보기
                    </button>
                    <button class="action-btn edit-btn" data-prd-id="${prd.id}">
                        <i class="material-icons">edit</i>
                        편집
                    </button>
                    <button class="action-btn version-btn" data-prd-id="${prd.id}">
                        <i class="material-icons">save</i>
                        버전저장
                    </button>
                    <button class="action-btn delete-btn" data-prd-id="${prd.id}">
                        <i class="material-icons">delete</i>
                        삭제
                    </button>
                </div>
            </div>
            <div class="prd-card-meta">
                <span class="prd-status ${prd.status}">${getStatusLabel(prd.status)}</span>
                <span class="prd-date">${new Date(prd.createdAt).toLocaleDateString('ko-KR')}</span>
                ${prd.version ? `<span class="prd-version">v${prd.version}</span>` : ''}
            </div>
            <div class="prd-card-preview">
                ${prd.content?.overview || prd.overview || '내용 미리보기 없음'}
            </div>
        `;
        return card;
    }

    function getStatusLabel(status) {
        const labels = { draft: '초안', modified: '수정됨', finalized: '완료됨' };
        return labels[status] || status;
    }
    
    function setupPRDCardListeners() {
        console.log('이벤트 리스너 설정 중...');
        
        // 모든 버튼에 이벤트 위임 방식으로 설정
        prdListContainer.addEventListener('click', (e) => {
            const button = e.target.closest('button');
            if (!button) return;
            
            const prdId = button.dataset.prdId;
            console.log('버튼 클릭됨:', button.className, 'PRD ID:', prdId);
            
            if (button.classList.contains('view-btn')) {
                viewPRD(prdId);
            } else if (button.classList.contains('edit-btn')) {
                editPRDPopup(prdId);
            } else if (button.classList.contains('version-btn')) {
                saveVersionPRD(prdId);
            } else if (button.classList.contains('delete-btn')) {
                deletePRD(prdId);
            }
        });
        
        console.log('이벤트 리스너 설정 완료');
    }
    
    async function viewPRD(prdId) {
        try {
            const response = await fetch(`/api/prd/${prdId}`);
            const prd = await response.json();
            
            // PRD 생성 화면으로 이동
            showPRDGeneration();
            
            // 저장된 PRD의 content 필드를 표시
            const prdContent = prd.content || prd;
            displayPRD(prdContent);
            
            // currentPRD에 전체 PRD 객체 저장 (저장 시 필요)
            currentPRD = prd;
            isEditing = true;
            
            showNotification('PRD를 불러왔습니다.');
        } catch (error) { 
            console.error('PRD 조회 에러:', error);
            showNotification('PRD를 불러오는데 실패했습니다.', 'error'); 
        }
    }



    async function deletePRD(prdId) {
        if (!confirm('정말로 이 PRD를 삭제하시겠습니까? 이 작업은 되돌릴 수 없습니다.')) return;
        try {
            const response = await fetch(`/api/prd/${prdId}`, { method: 'DELETE' });
            if (!response.ok) throw new Error('삭제 실패');
            showNotification('PRD가 성공적으로 삭제되었습니다.');
            loadPRDList();
        } catch (error) { showNotification('PRD 삭제에 실패했습니다.', 'error'); }
    }

    // --- PRD 편집 모달 로직 ---
    function openPRDEditDialog(prd = null) {
        if (prd) {
            currentPRD = prd;
            isEditing = true;
        }
        
        if (!currentPRD) {
            alert('편집할 PRD가 없습니다.');
            return;
        }

        console.log('편집 다이얼로그 열기, currentPRD:', currentPRD);

        // 더 간단하고 안전한 팝업 방식으로 변경
        console.log('간단한 팝업 편집 모드로 전환');
        openSimplePopupEdit(currentPRD);
    }
    
    // 간단한 팝업 편집 모드 (사용자 친화적)
    function openSimplePopupEdit(prd) {
        console.log('간단한 팝업 편집 모드 시작:', prd);
        
        // 편집 모드 UI 생성
        const editContainer = document.createElement('div');
        editContainer.id = 'simple-popup-edit-container';
        editContainer.style.cssText = `
            position: fixed;
            top: 5%;
            left: 5%;
            width: 90%;
            height: 90%;
            background: white;
            border: 3px solid #1976d2;
            border-radius: 12px;
            padding: 25px;
            z-index: 2000;
            overflow-y: auto;
            box-shadow: 0 8px 32px rgba(0,0,0,0.4);
            font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
        `;
        
        // PRD 내용을 보기 좋게 포맷 (JSON을 사용자 친화적으로 변환)
        const formatPRDForEdit = (prdData) => {
            // JSON 객체를 사용자 친화적인 텍스트로 변환하는 함수
            const formatObjectToText = (obj) => {
                if (!obj || typeof obj !== 'object') return '';
                
                let result = '';
                try {
                    Object.keys(obj).forEach(key => {
                        const value = obj[key];
                        if (Array.isArray(value)) {
                            result += `${key}:\n${value.map(item => `• ${typeof item === 'string' ? item : String(item)}`).join('\n')}\n\n`;
                        } else if (typeof value === 'object' && value !== null) {
                            result += `${key}:\n${formatObjectToText(value)}\n`;
                        } else {
                            result += `${key}: ${value || ''}\n\n`;
                        }
                    });
                } catch (error) {
                    console.warn('formatObjectToText 오류:', error);
                    return String(obj);
                }
                return result.trim();
            };

            // 배열을 사용자 친화적인 텍스트로 변환
            const formatArrayToText = (arr) => {
                if (!Array.isArray(arr)) return '';
                try {
                    return arr.map(item => {
                        if (typeof item === 'object' && item !== null) {
                            return `• ${Object.keys(item).map(key => `${key}: ${item[key] || ''}`).join(', ')}`;
                        }
                        return `• ${typeof item === 'string' ? item : String(item)}`;
                    }).join('\n');
                } catch (error) {
                    console.warn('formatArrayToText 오류:', error);
                    return String(arr);
                }
            };

            // PRD 구조 확인을 위한 디버깅
            console.log('편집할 PRD 데이터:', prdData);
            
            const sections = {};
            
            // 기본 텍스트 섹션
            if (prdData.overview) sections['제품 개요'] = prdData.overview;
            if (prdData.problem) sections['문제 정의'] = prdData.problem;
            
            // 목표가 객체인 경우와 문자열인 경우 모두 처리
            if (prdData.goals) {
                if (typeof prdData.goals === 'object') {
                    sections['목표'] = formatObjectToText(prdData.goals);
                } else {
                    sections['목표'] = prdData.goals;
                }
            }
            
            // 객체/배열 섹션
            if (prdData.competitiveAnalysis) sections['경쟁사 분석'] = formatObjectToText(prdData.competitiveAnalysis);
            if (prdData.technicalApproach) sections['기술적 접근'] = formatObjectToText(prdData.technicalApproach);
            
            // 업무용 AI 에이전트는 구현 세부사항만 표시
            if (prdData.implementationDetails) {
                sections['구현 세부사항'] = formatObjectToText(prdData.implementationDetails);
            }
            
            if (prdData.features) sections['핵심 기능'] = formatArrayToText(prdData.features);
            
            // 성공 지표는 업무용에서 제외 (필요시 주석 해제)
            // if (prdData.metrics) sections['성공 지표'] = formatObjectToText(prdData.metrics);
            
            let formHtml = '';
            Object.keys(sections).forEach(sectionName => {
                const content = sections[sectionName];
                // content가 문자열인지 확인하고 안전하게 처리
                const contentStr = typeof content === 'string' ? content : (content ? String(content) : '');
                if (contentStr && contentStr.trim() !== '') {
                    const minHeight = ['경쟁사 분석', '기술적 접근', '비즈니스 모델', '구현 세부사항', '핵심 기능', '성공 지표'].includes(sectionName) ? '150px' : '100px';
                    
                    formHtml += `
                        <div style="margin-bottom: 20px; background: #f8f9fa; padding: 15px; border-radius: 8px; border-left: 4px solid #1976d2;">
                            <label style="display: block; font-weight: bold; color: #1976d2; margin-bottom: 8px; font-size: 16px;">📝 ${sectionName}</label>
                            <textarea 
                                data-section="${sectionName}" 
                                style="width: 100%; min-height: ${minHeight}; padding: 12px; border: 2px solid #e0e0e0; border-radius: 6px; font-size: 14px; line-height: 1.6; resize: vertical; background: white; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;"
                                placeholder="${sectionName} 내용을 입력하세요..."
                            >${contentStr}</textarea>
                        </div>
                    `;
                }
            });
            return formHtml;
        };
        
        editContainer.innerHTML = `
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 25px; border-bottom: 2px solid #e0e0e0; padding-bottom: 15px;">
                <h2 style="margin: 0; color: #1976d2; font-size: 24px;">✏️ PRD 편집</h2>
                <div>
                    <button id="popup-save-btn" style="background: #4caf50; color: white; border: none; padding: 12px 20px; margin-right: 10px; border-radius: 6px; cursor: pointer; font-size: 16px; font-weight: bold;">💾 저장</button>
                    <button id="popup-cancel-btn" style="background: #f44336; color: white; border: none; padding: 12px 20px; border-radius: 6px; cursor: pointer; font-size: 16px; font-weight: bold;">❌ 취소</button>
                </div>
            </div>
            <div style="overflow-y: auto; max-height: calc(100% - 100px);">
                ${formatPRDForEdit(prd)}
            </div>
        `;
        
        // 이벤트 리스너 추가
        const saveBtn = editContainer.querySelector('#popup-save-btn');
        const cancelBtn = editContainer.querySelector('#popup-cancel-btn');
        
        saveBtn.onclick = () => {
            try {
                // 편집된 내용 수집
                const textareas = editContainer.querySelectorAll('textarea[data-section]');
                const editedPRD = { ...prd };
                
                // 사용자 친화적 텍스트를 JSON으로 변환하는 함수
                const parseTextToObject = (text) => {
                    const result = {};
                    const lines = text.split('\n');
                    let currentKey = '';
                    let currentValue = '';
                    
                    lines.forEach(line => {
                        line = line.trim();
                        if (line.includes(':') && !line.startsWith('•')) {
                            if (currentKey) {
                                result[currentKey] = currentValue.trim();
                            }
                            const [key, ...valueParts] = line.split(':');
                            currentKey = key.trim();
                            currentValue = valueParts.join(':').trim();
                        } else if (line.startsWith('•')) {
                            currentValue += '\n' + line;
                        } else if (line && currentKey) {
                            currentValue += '\n' + line;
                        }
                    });
                    
                    if (currentKey) {
                        result[currentKey] = currentValue.trim();
                    }
                    
                    return result;
                };

                const parseTextToArray = (text) => {
                    return text.split('\n')
                        .filter(line => line.trim().startsWith('•'))
                        .map(line => line.replace('•', '').trim())
                        .filter(item => item);
                };

                textareas.forEach(textarea => {
                    const sectionName = textarea.dataset.section;
                    const value = textarea.value.trim();
                    
                    // 섹션명을 영어 키로 매핑
                    const keyMapping = {
                        '제품 개요': 'overview',
                        '문제 정의': 'problem',
                        '목표': 'goals',
                        '경쟁사 분석': 'competitiveAnalysis',
                        '기술적 접근': 'technicalApproach',
                        '비즈니스 모델': 'businessModel',
                        '구현 세부사항': 'implementationDetails',
                        '핵심 기능': 'features',
                        '성공 지표': 'metrics'
                    };
                    
                    const englishKey = keyMapping[sectionName];
                    if (!englishKey) return;
                    
                    // 섹션별로 적절한 형태로 파싱
                    if (sectionName === '핵심 기능') {
                        // 배열로 파싱
                        editedPRD[englishKey] = parseTextToArray(value);
                    } else if (['경쟁사 분석', '기술적 접근', '구현 세부사항', '성공 지표', '목표'].includes(sectionName)) {
                        // 객체로 파싱 (목표가 객체 형태인 경우 포함)
                        if (value.includes(':') && !value.startsWith('•')) {
                            editedPRD[englishKey] = parseTextToObject(value);
                        } else {
                            editedPRD[englishKey] = value;
                        }
                    } else {
                        // 일반 텍스트
                        editedPRD[englishKey] = value;
                    }
                });
                
                // 기존 PRD의 ID 유지 (편집 시 ID 손실 방지)
                if (currentPRD && currentPRD.id) {
                    editedPRD.id = currentPRD.id;
                }
                
                currentPRD = editedPRD;
                displayPRD(editedPRD);
                document.body.removeChild(editContainer);
                alert('✅ PRD가 성공적으로 수정되었습니다!');
            } catch (error) {
                console.error('저장 오류:', error);
                alert('❌ 저장 중 오류가 발생했습니다: ' + error.message);
            }
        };
        
        cancelBtn.onclick = () => {
            const confirmCancel = confirm('편집을 취소하시겠습니까? 변경사항이 저장되지 않습니다.');
            if (confirmCancel) {
                document.body.removeChild(editContainer);
            }
        };
        
        // ESC 키로 닫기
        const handleEsc = (e) => {
            if (e.key === 'Escape') {
                cancelBtn.click();
                document.removeEventListener('keydown', handleEsc);
            }
        };
        document.addEventListener('keydown', handleEsc);
        
        // 편집 컨테이너를 페이지에 추가
        document.body.appendChild(editContainer);
        
        // 첫 번째 텍스트 영역에 포커스
        const firstTextarea = editContainer.querySelector('textarea');
        if (firstTextarea) {
            firstTextarea.focus();
        }
        
        console.log('팝업 편집 모드 표시 완료');
    }


    
    function generatePRDTitle(prd) {
        return (prd && prd.overview) ? prd.overview.substring(0, 50) + '...' : '새로운 PRD';
    }
    
    function createPRDEditor(prd) {
        console.log('PRD 에디터 생성 시작:', prd);
        
        if (!prd) {
            console.error('PRD 데이터가 없습니다:', prd);
            const errorDiv = document.createElement('div');
            errorDiv.innerHTML = '<p>PRD 데이터를 불러올 수 없습니다.</p>';
            return errorDiv;
        }

        const container = document.createElement('div');
        const sections = [
            { id: 'overview', title: '제품 개요', content: prd.overview },
            { id: 'problem', title: '문제 정의', content: prd.problem },
            { id: 'goals', title: '목표', content: prd.goals },
            { id: 'competitiveAnalysis', title: '경쟁사 분석', content: prd.competitiveAnalysis },
            { id: 'technicalApproach', title: '기술적 접근', content: prd.technicalApproach },
            // businessModel 또는 implementationDetails 조건부 처리
            ...(prd.businessModel ? [{ id: 'businessModel', title: '비즈니스 모델', content: prd.businessModel }] : []),
            ...(prd.implementationDetails ? [{ id: 'implementationDetails', title: '구현 세부사항', content: prd.implementationDetails }] : []),
            { id: 'features', title: '핵심 기능', content: prd.features },
            { id: 'metrics', title: '성공 지표', content: prd.metrics },
        ];

        sections.forEach(section => {
            const sectionEl = document.createElement('div');
            sectionEl.className = 'prd-editor-section';
            sectionEl.dataset.sectionId = section.id; // 섹션 ID 추가
            let contentString = '';
            const content = section.content;

            if (typeof content === 'object' && content !== null) {
                if (section.id === 'features' && Array.isArray(content)) {
                    contentString = content.map(f => `${f.title} (${f.priority}): ${f.description}`).join('\n');
                } else {
                    contentString = Object.entries(content).map(([key, value]) => {
                         if (typeof value === 'object' && value !== null) {
                             return `${key}:\n${Object.entries(value).map(([subKey, subValue]) => `  ${subKey}: ${subValue}`).join('\n')}`;
                         }
                         return `${key}: ${value}`;
                    }).join('\n');
                }
            } else { contentString = content || ''; }
            
            sectionEl.innerHTML = `<h3>${section.title}</h3><textarea id="editor-${section.id}" class="mdc-text-field__input">${contentString}</textarea>`;
            container.appendChild(sectionEl);
        });
        return container;
    }
    
    async function savePRD() {
        const title = document.getElementById('prd-title-input').value.trim();
        const status = prdStatusSelect.value;

        if (!title) {
            showNotification('제목을 입력해주세요.', 'error');
            return;
        }

        if (!currentPRD) {
            showNotification('저장할 PRD가 없습니다.', 'error');
            return;
        }

        try {
            showNotification('PRD를 저장하고 있습니다...', 'info');

            const contentElement = document.getElementById('prd-editor-content');
            const content = contentElement ? parseEditorContent() : currentPRD.content;

            const prdData = {
                title,
                content,
                status,
                tags: [],
                originalContent: currentPRD
            };

            const url = isEditing ? `/api/prd/${currentPRD.id}` : '/api/prd/save';
            const method = isEditing ? 'PUT' : 'POST';

            const response = await fetch(url, {
                method,
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(prdData)
            });

            if (!response.ok) throw new Error('저장 실패');

            const result = await response.json();
            
            // 새로 저장된 PRD의 경우 currentPRD에 ID 설정
            if (!isEditing && result.id) {
                currentPRD.id = result.id;
                console.log('PRD 저장 완료, ID 설정:', result.id);
            }
            
            showNotification(isEditing ? 'PRD가 수정되었습니다.' : 'PRD가 저장되었습니다.', 'success');

            // 편집 다이얼로그 닫기
            document.getElementById('prd-edit-dialog').style.display = 'none';
            
            // PRD 관리 화면에서 목록 새로고침
            if (document.getElementById('prd-management-view').style.display !== 'none') {
                loadPRDList();
            }

        } catch (error) {
            console.error('PRD 저장 오류:', error);
            showNotification('PRD 저장에 실패했습니다.', 'error');
        }
    }
    
    function parseFeatures(text) {
        return text.split('\n').map(line => {
            const match = line.match(/(.*?)\s?\((.*?)\):\s?(.*)/);
            if (match) return { title: match[1].trim(), priority: match[2].trim(), description: match[3].trim() };
            return null;
        }).filter(Boolean);
    }

    function parseEditorContent() {
        const editorContainer = document.getElementById('prd-editor-container');
        const content = {};
        
        // 각 섹션별로 데이터 수집
        const sections = editorContainer.querySelectorAll('.prd-editor-section');
        sections.forEach(section => {
            const sectionId = section.dataset.sectionId;
            const textarea = section.querySelector('textarea');
            
            if (!textarea || !sectionId) return;
            
            let value = textarea.value.trim();
            
            // 특별한 섹션들 처리
            if (sectionId === 'features') {
                content[sectionId] = parseFeatures(value);
            } else if (sectionId === 'goals') {
                // goals는 객체 형태로 파싱
                const lines = value.split('\n').filter(line => line.trim());
                const goals = {};
                lines.forEach(line => {
                    if (line.includes('주요 목표:') || line.includes('primary:')) {
                        goals.primary = line.split(':')[1]?.trim() || '';
                    } else if (line.includes('보조 목표:') || line.includes('secondary:')) {
                        goals.secondary = line.split(':')[1]?.trim() || '';
                    }
                });
                content[sectionId] = goals;
            } else if (['competitiveAnalysis', 'technicalApproach', 'businessModel', 'implementationDetails', 'metrics'].includes(sectionId)) {
                // 객체 형태의 섹션들은 JSON으로 파싱 시도
                try {
                    content[sectionId] = JSON.parse(value);
                } catch {
                    // JSON 파싱 실패 시 문자열로 저장
                    content[sectionId] = value;
                }
            } else {
                content[sectionId] = value;
            }
        });
        
        return content;
    }

    // --- 이벤트 리스너 초기화 (더 안전한 방식) ---
    
    // 편집 버튼 이벤트 리스너 (여러 방식으로 시도)
    function setupEditButton() {
        const editButton = document.getElementById('edit-btn');
        if (editButton) {
            console.log('편집 버튼 발견:', editButton);
            
            // 기존 이벤트 리스너 제거 후 재설정
            editButton.onclick = null;
            editButton.removeEventListener('click', handleEditClick);
            
            // 새 이벤트 리스너 추가
            editButton.addEventListener('click', handleEditClick);
            editButton.style.pointerEvents = 'auto';
            editButton.style.cursor = 'pointer';
            
            console.log('편집 버튼 이벤트 리스너 설정 완료');
        } else {
            console.error('편집 버튼을 찾을 수 없습니다!');
        }
    }
    
    function handleEditClick(e) {
        e.preventDefault();
        e.stopPropagation();
        console.log('편집 버튼 클릭됨! currentPRD:', currentPRD);
        
        if (!currentPRD) {
            alert('편집할 PRD가 없습니다. 먼저 PRD를 생성해주세요.');
            return;
        }
        
        try {
            // PRD 데이터 확인 및 정리
            console.log('편집할 currentPRD 전체:', currentPRD);
            
            // currentPRD에 content 필드가 있는 경우 그것을 사용, 없으면 currentPRD 자체를 사용
            const prdToEdit = currentPRD.content || currentPRD;
            console.log('실제 편집할 PRD 데이터:', prdToEdit);
            
            // 바로 팝업 편집 모드로 이동
            openSimplePopupEdit(prdToEdit);
        } catch (error) {
            console.error('편집 다이얼로그 오류:', error);
            alert('편집 중 오류가 발생했습니다: ' + error.message);
        }
    }
    
    // 버전저장 버튼 이벤트 리스너
    function setupVersionSaveButton() {
        const versionButton = document.getElementById('version-save-btn');
        if (versionButton) {
            console.log('버전저장 버튼 발견:', versionButton);
            
            versionButton.onclick = null;
            versionButton.removeEventListener('click', handleVersionSaveClick);
            versionButton.addEventListener('click', handleVersionSaveClick);
            versionButton.style.pointerEvents = 'auto';
            versionButton.style.cursor = 'pointer';
            
            console.log('버전저장 버튼 이벤트 리스너 설정 완료');
        } else {
            console.error('버전저장 버튼을 찾을 수 없습니다!');
        }
    }
    
    async function handleVersionSaveClick(e) {
        e.preventDefault();
        e.stopPropagation();
        console.log('버전저장 버튼 클릭됨! currentPRD:', currentPRD);
        
        if (!currentPRD) {
            alert('저장할 PRD가 없습니다. 먼저 PRD를 생성해주세요.');
            return;
        }
        
        // PRD ID가 없는 경우 (복원된 PRD) 먼저 새로운 PRD로 저장
        if (!currentPRD.id) {
            console.log('PRD ID가 없음. 새로운 PRD로 먼저 저장합니다.');
            const confirm저장 = confirm('이 PRD는 아직 저장되지 않았습니다.\n먼저 새로운 PRD로 저장한 후 버전을 관리하시겠습니까?');
            if (!confirm저장) return;
            
            try {
                showNotification('PRD를 먼저 저장하고 있습니다...', 'info');
                
                const saveResponse = await fetch('/api/prd/save', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        title: generatePRDTitle(currentPRD),
                        content: currentPRD,
                        status: 'draft'
                    })
                });
                
                if (!saveResponse.ok) {
                    throw new Error('PRD 저장 실패');
                }
                
                const saveResult = await saveResponse.json();
                currentPRD.id = saveResult.id; // ID 설정
                console.log('PRD 저장 완료, ID:', currentPRD.id);
                
            } catch (error) {
                console.error('PRD 저장 오류:', error);
                alert('PRD 저장 중 오류가 발생했습니다: ' + error.message);
                return;
            }
        }
        
        const versionNote = prompt('버전 저장 노트를 입력하세요 (선택사항):\n예: "UI 개선", "기능 추가", "초기 버전" 등');
        if (versionNote === null) {
            console.log('버전 저장 취소됨');
            return; // 취소한 경우
        }
        
        const finalNote = versionNote.trim() || `자동 생성 - ${new Date().toLocaleString()}`;
        
        try {
            showNotification('버전을 저장하고 있습니다...', 'info');
            
            const response = await fetch(`/api/prd/${currentPRD.id}/save-version`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ versionNote: finalNote })
            });
            
            if (!response.ok) throw new Error('버전 저장 실패');
            
            const result = await response.json();
            showNotification(`${result.message} 관리 화면에서 확인할 수 있습니다.`, 'success');
            
        } catch (error) {
            console.error('버전 저장 오류:', error);
            alert('버전 저장 중 오류가 발생했습니다.');
        }
    }
    
    showManagementBtn.addEventListener('click', showPRDManagement);
    refreshPrdListBtn.addEventListener('click', loadPRDList);
    statusFilter.listen('MDCSelect:change', () => loadPRDList());
    prdSearchInput.addEventListener('input', debounce(loadPRDList, 300));
    prdEditDialog.listen('MDCDialog:closing', (event) => {
        if (event.detail.action === 'save') savePRD();
    });

    // --- 페이지 로드 시 저장된 PRD 복원 ---
    function restoreLastPRD() {
        const savedPRD = loadPRDFromSession();
        if (savedPRD) {
            console.log('PRD 복원 시작:', savedPRD);
            currentPRD = savedPRD;
            
            // 결과 섹션 표시
            resultSection.style.display = 'block';
            
            // PRD 내용 표시 (저장 로직 제외)
            displayPRDContent(savedPRD);
            
            alert('이전에 생성된 PRD를 복원했습니다. 🔄');
        } else {
            console.log('복원할 PRD가 없습니다.');
        }
        
        // 입력창 내용 복원
        try {
            const savedInput = localStorage.getItem('lastIdeaInput');
            if (savedInput && ideaInput) {
                ideaInput.value = savedInput;
                updateCharCount();
                console.log('입력창 내용도 복원됨');
            }
        } catch (error) {
            console.error('입력창 복원 오류:', error);
        }
    }

    // PRD 내용만 표시하는 함수 (중복 저장 방지)
    function displayPRDContent(prd) {
        prdContent.innerHTML = '';

        const sections = [
            { id: 'overview', title: '제품 개요', content: prd.overview },
            { id: 'problem', title: '문제 정의', content: prd.problem },
            { id: 'goals', title: '목표', content: prd.goals },
            { id: 'competitiveAnalysis', title: '경쟁사 분석', content: prd.competitiveAnalysis },
            { id: 'technicalApproach', title: '기술적 접근', content: prd.technicalApproach },
            // 업무용 AI 에이전트는 구현 세부사항만 표시
            { id: 'implementationDetails', title: '구현 세부사항', content: prd.implementationDetails },
            { id: 'features', title: '핵심 기능', content: prd.features },
            // 비즈니스 모델과 성공 지표는 업무용에서 제외
            // { id: 'businessModel', title: '비즈니스 모델', content: prd.businessModel },
            // { id: 'metrics', title: '성공 지표', content: prd.metrics },
        ];

        sections.forEach(section => {
            // 내용이 있는 경우에만 섹션 생성
            if (section.content && 
                (typeof section.content === 'string' ? section.content.trim() : true) &&
                !(Array.isArray(section.content) && section.content.length === 0) &&
                !(typeof section.content === 'object' && Object.keys(section.content).length === 0)) {
                prdContent.appendChild(createPRDSection(section.title, section.content, section.id));
            }
        });
    }

    // 모든 버튼 이벤트 리스너 설정
    function initializeAllButtons() {
        console.log('=== 버튼 초기화 시작 ===');
        setupEditButton();
        setupVersionSaveButton(); 
        setupCopyButton();
        setupResetButton();
        
        // 추가: 복사 버튼 이벤트 델리게이션
        document.addEventListener('click', function(e) {
            if (e.target.closest('#copy-all-btn')) {
                e.preventDefault();
                e.stopPropagation();
                console.log('이벤트 델리게이션으로 복사 버튼 클릭 감지!');
                handleCopyClick(e);
            }
        });
        
        console.log('=== 버튼 초기화 완료 ===');
    }

    // 페이지 로드 완료 후 초기화
    setTimeout(() => {
        console.log('=== 페이지 초기화 시작 ===');
        
        // 버튼 초기화
        initializeAllButtons();
        
        // PRD 복원 시도
        console.log('localStorage 지원:', typeof Storage !== "undefined");
        console.log('현재 localStorage 상태:');
        console.log('- lastGeneratedPRD:', localStorage.getItem('lastGeneratedPRD') ? '있음' : '없음');
        console.log('- lastGeneratedPRD_timestamp:', localStorage.getItem('lastGeneratedPRD_timestamp'));
        
        restoreLastPRD();
        console.log('=== 페이지 초기화 완료 ===');
    }, 500);

    // --- 문자 카운터 업데이트 ---
    function updateCharCount() {
        const charCount = document.getElementById('char-count');
        if (charCount && ideaInput) {
            const currentLength = ideaInput.value.length;
            charCount.textContent = `${currentLength.toLocaleString()} / 50,000자`;
            
            // 글자 수에 따른 색상 변경
            if (currentLength > 45000) {
                charCount.style.color = '#f44336'; // 빨간색
            } else if (currentLength > 40000) {
                charCount.style.color = '#ff9800'; // 주황색
            } else {
                charCount.style.color = '#666'; // 기본 색상
            }
        }
    }

    // 동적 날짜 정보 생성 함수
    function getDateInfo() {
        const now = new Date();
        const threeMonthsAgo = new Date();
        threeMonthsAgo.setMonth(threeMonthsAgo.getMonth() - 3);
        
        const currentDate = now.toLocaleDateString('ko-KR', {
            year: 'numeric',
            month: 'long',
            day: 'numeric'
        });
        
        const startMonth = threeMonthsAgo.toLocaleDateString('ko-KR', {
            year: 'numeric',
            month: 'long'
        });
        
        return {
            currentDate,
            period: `최근 3개월 (${startMonth} ~ 현재)`
        };
    }

    // 실시간 검색 상태 표시 함수 (업데이트)
    function showSearchStatus(message) {
        const loadingModal = document.getElementById('loading-modal');
        const statusText = loadingModal.querySelector('.status-text');
        const dateInfo = getDateInfo();
        
        if (statusText) {
            statusText.innerHTML = `
                <div>
                    <div class="spinner"></div>
                    <p>${message}</p>
                    <small style="color: #666; margin-top: 8px; display: block;">
                        🔍 ${dateInfo.period} 최신 AI 동향 검색 중... (${dateInfo.currentDate} 기준)
                    </small>
                </div>
            `;
        }
    }

    // 입력창 이벤트 리스너
    if (ideaInput) {
        ideaInput.addEventListener('input', updateCharCount);
        // 초기 카운터 설정
        updateCharCount();
    }

    // 복사 버튼 이벤트 리스너
    function setupCopyButton() {
        const copyButton = document.getElementById('copy-all-btn');
        if (copyButton) {
            console.log('복사 버튼 발견:', copyButton);
            
            // 기존 이벤트 제거
            copyButton.replaceWith(copyButton.cloneNode(true));
            const newCopyButton = document.getElementById('copy-all-btn');
            
            newCopyButton.addEventListener('click', handleCopyClick);
            newCopyButton.style.pointerEvents = 'auto';
            newCopyButton.style.cursor = 'pointer';
            
            console.log('복사 버튼 이벤트 리스너 설정 완료');
        } else {
            console.error('복사 버튼을 찾을 수 없습니다!');
        }
    }
    
    async function handleCopyClick(e) {
        e.preventDefault();
        e.stopPropagation();
        console.log('복사 버튼 클릭됨! currentPRD:', currentPRD);
        
        if (!currentPRD) {
            showNotification('복사할 PRD가 없습니다.', 'error');
            return;
        }

        try {
            // PRD 내용을 텍스트로 변환
            const prdText = convertPRDToText(currentPRD);
            console.log('변환된 PRD 텍스트 길이:', prdText.length);
            
            // 클립보드 API 시도
            if (navigator.clipboard && window.isSecureContext) {
                await navigator.clipboard.writeText(prdText);
                showNotification('PRD가 클립보드에 복사되었습니다!', 'success');
            } else {
                // 폴백: 텍스트 영역 방식
                const textArea = document.createElement('textarea');
                textArea.value = prdText;
                textArea.style.position = 'fixed';
                textArea.style.left = '-999999px';
                textArea.style.top = '-999999px';
                document.body.appendChild(textArea);
                textArea.focus();
                textArea.select();
                
                const successful = document.execCommand('copy');
                document.body.removeChild(textArea);
                
                if (successful) {
                    showNotification('PRD가 클립보드에 복사되었습니다!', 'success');
                } else {
                    throw new Error('복사 명령 실행 실패');
                }
            }
        } catch (error) {
            console.error('복사 실패:', error);
            showNotification('복사에 실패했습니다. 다시 시도해주세요.', 'error');
        }
    }

    // 리셋 버튼 이벤트 리스너  
    function setupResetButton() {
        const resetButton = document.getElementById('reset-prd-btn');
        if (resetButton) {
            console.log('리셋 버튼 발견:', resetButton);
            
            resetButton.onclick = null;
            resetButton.addEventListener('click', handleResetClick);
            resetButton.style.pointerEvents = 'auto';
            resetButton.style.cursor = 'pointer';
            
            console.log('리셋 버튼 이벤트 리스너 설정 완료');
        } else {
            console.error('리셋 버튼을 찾을 수 없습니다!');
        }
    }
    
    function handleResetClick(e) {
        e.preventDefault();
        e.stopPropagation();
        console.log('리셋 버튼 클릭됨!');
        
        if (confirm('현재 PRD 결과를 삭제하시겠습니까?\n이 작업은 되돌릴 수 없습니다.')) {
            // PRD 화면 숨기기
            resultSection.style.display = 'none';
            prdContent.innerHTML = '';
            
            // 상태 초기화
            currentPRD = null;
            isEditing = false;
            
            // 로컬 스토리지 클리어
            clearPRDSession();
            
            // 입력창 초기화 및 포커스
            ideaInput.value = '';
            ideaInput.focus();
            updateCharCount();
            
            alert('PRD가 리셋되었습니다. 새로운 아이디어를 입력해주세요.');
            console.log('PRD 리셋 완료');
        }
    }

    // PRD 객체를 텍스트로 변환하는 함수 - 화면 표시 내용과 동일하게
    function convertPRDToText(prd) {
        const sections = [];
        
        // 화면에 실제 표시된 섹션들만 복사 (비즈니스 모델, 성공지표 제외)
        if (prd.overview) {
            sections.push(`## 제품 개요\n${prd.overview}`);
        }
        
        if (prd.problem) {
            sections.push(`## 문제 정의\n${prd.problem}`);
        }
        
        if (prd.goals) {
            let goalsText = `## 목표\n`;
            if (typeof prd.goals === 'string') {
                goalsText += prd.goals;
            } else if (typeof prd.goals === 'object') {
                if (prd.goals.primary && prd.goals.secondary) {
                    goalsText += `**주요 목표:** ${prd.goals.primary}\n**보조 목표:** ${prd.goals.secondary}`;
                } else {
                    // 객체를 텍스트로 변환
                    Object.entries(prd.goals).forEach(([key, value]) => {
                        goalsText += `**${key}:** ${value}\n`;
                    });
                }
            }
            sections.push(goalsText);
        }
        
        // 경쟁 분석
        if (prd.competitiveAnalysis) {
            let compAnalysis = `## 경쟁 분석\n`;
            
            if (prd.competitiveAnalysis.referenceServices || prd.competitiveAnalysis['참고서비스']) {
                const refServices = prd.competitiveAnalysis.referenceServices || prd.competitiveAnalysis['참고서비스'];
                compAnalysis += `### 참고 서비스\n`;
                if (typeof refServices === 'object') {
                    Object.entries(refServices).forEach(([service, description]) => {
                        compAnalysis += `**${service}:** ${description}\n\n`;
                    });
                }
            }
            
            if (prd.competitiveAnalysis.differentiators || prd.competitiveAnalysis['차별화요소']) {
                const differentiators = prd.competitiveAnalysis.differentiators || prd.competitiveAnalysis['차별화요소'];
                compAnalysis += `### 차별화 요소\n`;
                if (Array.isArray(differentiators)) {
                    differentiators.forEach(diff => {
                        compAnalysis += `- ${diff}\n`;
                    });
                }
                compAnalysis += `\n`;
            }
            
            if (prd.competitiveAnalysis.marketGap || prd.competitiveAnalysis['시장기회']) {
                const marketGap = prd.competitiveAnalysis.marketGap || prd.competitiveAnalysis['시장기회'];
                compAnalysis += `### 시장 기회\n${marketGap}`;
            }
            
            sections.push(compAnalysis);
        }
        
        // 기술적 접근 방법 - 화면에 표시되는 구조와 동일하게
        if (prd.technicalApproach) {
            let techApproach = `## 기술적 접근 방법\n`;
            
            // 객체 구조를 평문으로 변환
            if (typeof prd.technicalApproach === 'object') {
                Object.entries(prd.technicalApproach).forEach(([key, value]) => {
                    if (value && value.toString().trim()) {
                        let sectionTitle = key;
                        if (key === '아키텍처') sectionTitle = '### 아키텍처';
                        else if (key === '데이터처리') sectionTitle = '### 데이터 처리';
                        else if (key === '핵심기술') sectionTitle = '### 핵심 기술';
                        else if (key === '확장성') sectionTitle = '### 확장성';
                        else sectionTitle = `### ${key}`;
                        
                        techApproach += `${sectionTitle}\n${value}\n\n`;
                    }
                });
            } else if (typeof prd.technicalApproach === 'string') {
                techApproach += prd.technicalApproach;
            }
            
            sections.push(techApproach.trim());
        }
        
        // implementationDetails 섹션 (비즈니스 모델 대신)
        if (prd.implementationDetails) {
            let implDetails = `## 구현 세부사항\n`;
            
            if (typeof prd.implementationDetails === 'object') {
                Object.entries(prd.implementationDetails).forEach(([key, value]) => {
                    if (value && value.toString().trim()) {
                        let sectionTitle = key;
                        if (key === 'apiDesign') sectionTitle = '### API 설계';
                        else if (key === 'dataSchema') sectionTitle = '### 데이터 스키마';
                        else if (key === 'security') sectionTitle = '### 보안 요구사항';
                        else if (key === 'integration') sectionTitle = '### 통합 방법';
                        else if (key === 'performance') sectionTitle = '### 성능 기준';
                        else if (key === 'deployment') sectionTitle = '### 배포';
                        else if (key === 'monitoring') sectionTitle = '### 모니터링';
                        else sectionTitle = `### ${key}`;
                        
                        implDetails += `${sectionTitle}\n${value}\n\n`;
                    }
                });
            }
            
            sections.push(implDetails.trim());
        }
        
        // 기능 목록 - 화면 표시와 동일하게
        if (prd.features && prd.features.length > 0) {
            let features = `## 주요 기능\n`;
            prd.features.forEach((feature, index) => {
                features += `### ${index + 1}. ${feature.title} (${feature.priority})\n${feature.description}\n\n`;
            });
            sections.push(features.trim());
        }
        
        // 성공 지표는 제외 (화면에 표시되지 않음)
        
        return sections.join('\n\n---\n\n');
    }

    // 팝업으로 PRD 편집 (기존 editPRD 대체)
    async function editPRDPopup(prdId) {
        try {
            const response = await fetch(`/api/prd/${prdId}`);
            if (!response.ok) throw new Error('PRD 로드 실패');
            
            const prd = await response.json();
            
            // 편집 다이얼로그 열기
            openPRDEditDialog(prd);
            
        } catch (error) {
            console.error('PRD 편집 오류:', error);
            showNotification('PRD 편집 중 오류가 발생했습니다.', 'error');
        }
    }

    // 버전저장 함수
    async function saveVersionPRD(prdId) {
        const versionNote = prompt('버전 저장 노트를 입력하세요 (선택사항):') || '';
        
        if (versionNote === null) return; // 취소한 경우
        
        try {
            showNotification('버전을 저장하고 있습니다...', 'info');
            
            const response = await fetch(`/api/prd/${prdId}/save-version`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ versionNote })
            });
            
            if (!response.ok) throw new Error('버전 저장 실패');
            
            const result = await response.json();
            
            showNotification(result.message, 'success');
            loadPRDList(); // 목록 새로고침
            
        } catch (error) {
            console.error('버전 저장 오류:', error);
            showNotification('버전 저장 중 오류가 발생했습니다.', 'error');
        }
    }

    // --- 페이지 초기화 ---
    // 동적 날짜 업데이트
    updateDynamicDates();
    
    // 저장된 PRD 복원 시도
    setTimeout(() => {
        try {
            const savedPRD = loadPRDFromSession();
            if (savedPRD) {
                console.log('저장된 PRD 발견, 복원 중...');
                displayPRD(savedPRD);
                
                // 입력창 내용도 복원
                const savedInput = localStorage.getItem('lastIdeaInput');
                if (savedInput && ideaInput) {
                    ideaInput.value = savedInput;
                    updateCharCount();
                }
                
                                 // 자동 복원은 조용하게 처리 (필요시에만 알림)
                 console.log('✅ 이전 PRD 자동 복원 완료');
            } else {
                console.log('저장된 PRD 없음');
            }
        } catch (error) {
            console.error('PRD 복원 실패:', error);
        }
    }, 100); // 약간의 지연으로 UI 요소가 완전히 로드된 후 실행
}); 

    // 페이지 초기화 시 동적 날짜 설정
    function updateDynamicDates() {
        const dateInfo = getDateInfo();

        // 히어로 섹션 하이라이트 업데이트
        const searchHighlight = document.getElementById('search-highlight');
        if (searchHighlight) {
            searchHighlight.textContent = `🔍 실시간 최신 AI 기술 동향 반영 (${dateInfo.currentDate} 기준)`;
        }

        // 검색 정보 업데이트
        const searchInfo = document.querySelector('.search-info span');
        if (searchInfo) {
            searchInfo.textContent = `AI 관련 내용 입력 시 GitHub, Hugging Face 등에서 ${dateInfo.period} 최신 정보를 자동 검색합니다`;
        }

        console.log(`페이지 날짜 정보 업데이트: ${dateInfo.currentDate}, 검색 범위: ${dateInfo.period}`);
    }

 