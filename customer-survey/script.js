// 고객 설문 시스템 JavaScript

document.addEventListener('DOMContentLoaded', function() {
    console.log('🎯 고객 설문 시스템 초기화 시작');
    
    // DOM 요소 참조
    const form = document.getElementById('survey-form');
    const submitBtn = document.getElementById('submit-btn');
    const btnText = submitBtn.querySelector('.btn-text');
    const btnLoading = submitBtn.querySelector('.btn-loading');
    
    // 글자수 카운터 초기화
    initCharCounters();
    
    // 폼 검증 초기화
    initFormValidation();
    
    // 폼 제출 이벤트
    form.addEventListener('submit', handleFormSubmit);
    
    console.log('✅ 고객 설문 시스템 초기화 완료');
    
    // 글자수 카운터 초기화
    function initCharCounters() {
        const counters = document.querySelectorAll('.char-counter');
        
        counters.forEach(counter => {
            const targetId = counter.getAttribute('data-target');
            const targetElement = document.getElementById(targetId);
            
            if (targetElement) {
                updateCharCounter(targetElement, counter);
                
                targetElement.addEventListener('input', () => {
                    updateCharCounter(targetElement, counter);
                });
            }
        });
    }
    
    function updateCharCounter(element, counter) {
        const maxLength = element.getAttribute('maxlength');
        const currentLength = element.value.length;
        
        counter.textContent = `${currentLength.toLocaleString()} / ${parseInt(maxLength).toLocaleString()}자`;
        
        // 90% 이상시 경고 색상
        if (currentLength > maxLength * 0.9) {
            counter.style.color = '#e53e3e';
        } else if (currentLength > maxLength * 0.8) {
            counter.style.color = '#ff9800';
        } else {
            counter.style.color = '#718096';
        }
    }
    
    // 폼 검증 초기화
    function initFormValidation() {
        const requiredFields = form.querySelectorAll('[required]');
        
        requiredFields.forEach(field => {
            field.addEventListener('blur', () => validateField(field));
            field.addEventListener('input', () => clearFieldError(field));
        });
        
        // 상담 시간 특별 검증
        const consultationTimeCheckboxes = form.querySelectorAll('input[name="consultationTime"]');
        consultationTimeCheckboxes.forEach(checkbox => {
            checkbox.addEventListener('change', validateConsultationTime);
        });
    }
    
    function validateField(field) {
        const formGroup = field.closest('.form-group');
        clearFieldError(field);
        
        if (field.hasAttribute('required') && !field.value.trim()) {
            showFieldError(field, '필수 입력 항목입니다.');
            return false;
        }
        
        if (field.type === 'email' && field.value) {
            const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
            if (!emailRegex.test(field.value)) {
                showFieldError(field, '올바른 이메일 형식을 입력해주세요.');
                return false;
            }
        }
        
        if (field.type === 'tel' && field.value) {
            const phoneRegex = /^[0-9]{2,3}-[0-9]{3,4}-[0-9]{4}$/;
            if (!phoneRegex.test(field.value)) {
                showFieldError(field, '올바른 전화번호 형식을 입력해주세요. (예: 010-1234-5678)');
                return false;
            }
        }
        
        formGroup.classList.add('success');
        return true;
    }
    
    function validateConsultationTime() {
        const checkboxes = form.querySelectorAll('input[name="consultationTime"]');
        const checked = Array.from(checkboxes).some(cb => cb.checked);
        const formGroup = checkboxes[0].closest('.form-group');
        
        if (!checked) {
            showFieldError(checkboxes[0], '상담 가능 시간대를 최소 하나 이상 선택해주세요.');
            return false;
        } else {
            clearFieldError(checkboxes[0]);
            formGroup.classList.add('success');
            return true;
        }
    }
    
    function showFieldError(field, message) {
        const formGroup = field.closest('.form-group');
        formGroup.classList.add('error');
        formGroup.classList.remove('success');
        
        // 기존 에러 메시지 제거
        const existingError = formGroup.querySelector('.error-message');
        if (existingError) {
            existingError.remove();
        }
        
        // 새 에러 메시지 추가
        const errorElement = document.createElement('span');
        errorElement.className = 'error-message';
        errorElement.textContent = message;
        field.parentNode.appendChild(errorElement);
    }
    
    function clearFieldError(field) {
        const formGroup = field.closest('.form-group');
        formGroup.classList.remove('error');
        
        const errorMessage = formGroup.querySelector('.error-message');
        if (errorMessage) {
            errorMessage.remove();
        }
    }
    
    // 폼 제출 처리
    async function handleFormSubmit(event) {
        event.preventDefault();
        console.log('📋 설문 제출 시작');
        
        // 전체 폼 검증
        if (!validateForm()) {
            console.log('❌ 폼 검증 실패');
            return;
        }
        
        // 제출 버튼 로딩 상태
        setSubmitLoading(true);
        
        try {
            // 폼 데이터 수집
            const formData = collectFormData();
            console.log('📋 폼 데이터 수집 완료:', formData);
            
            // PRD 생성 (기존 API 사용)
            console.log('🤖 AI PRD 생성 시작...');
            const prdResult = await generatePRD(formData);
            console.log('✅ PRD 생성 완료');
            
            // 이메일 발송
            console.log('📧 이메일 발송 시작...');
            await sendConsultationEmail(formData, prdResult);
            console.log('✅ 이메일 발송 완료');
            
            // 성공 처리
            showSuccessMessage();
            
        } catch (error) {
            console.error('❌ 설문 처리 오류:', error);
            showErrorMessage(error.message);
        } finally {
            setSubmitLoading(false);
        }
    }
    
    function validateForm() {
        let isValid = true;
        
        // 필수 필드 검증
        const requiredFields = form.querySelectorAll('[required]');
        requiredFields.forEach(field => {
            if (!validateField(field)) {
                isValid = false;
            }
        });
        
        // 상담 시간 검증
        if (!validateConsultationTime()) {
            isValid = false;
        }
        
        // 개인정보 동의 검증
        const privacyAgreement = document.getElementById('privacy-agreement');
        if (!privacyAgreement.checked) {
            showFieldError(privacyAgreement, '개인정보 수집 및 이용에 동의해주세요.');
            isValid = false;
        }
        
        return isValid;
    }
    
    function collectFormData() {
        const formData = new FormData(form);
        const data = {};
        
        // 일반 폼 데이터
        for (let [key, value] of formData.entries()) {
            if (key !== 'consultationTime') {
                data[key] = value;
            }
        }
        
        // 상담 시간 (복수 선택)
        const consultationTimes = [];
        const timeCheckboxes = form.querySelectorAll('input[name="consultationTime"]:checked');
        timeCheckboxes.forEach(checkbox => {
            consultationTimes.push(checkbox.value);
        });
        data.consultationTime = consultationTimes;
        
        return data;
    }
    
    async function generatePRD(formData) {
        // 기존 PRD AI 에이전트 API 사용
        const ideaText = createIdeaText(formData);
        
        const response = await fetch('/api/generate-prd', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                idea: ideaText,
                clientInfo: {
                    name: formData.contactName,
                    email: formData.contactEmail,
                    company: formData.companyName,
                    team: formData.teamName,
                    jobTitle: formData.jobTitle
                }
            })
        });
        
        if (!response.ok) {
            throw new Error(`PRD 생성 실패: ${response.statusText}`);
        }
        
        return await response.json();
    }
    
    function createIdeaText(formData) {
        // 설문 데이터를 PRD 생성용 텍스트로 변환
        let ideaText = `비즈니스 아이디어: ${formData.businessIdea}\n\n`;
        ideaText += `타겟 사용자: ${formData.targetUsers}\n\n`;
        
        if (formData.keyFeatures) {
            ideaText += `핵심 기능: ${formData.keyFeatures}\n\n`;
        }
        
        if (formData.budgetTimeline) {
            ideaText += `예산 및 일정: ${formData.budgetTimeline}\n\n`;
        }
        
        if (formData.additionalRequests) {
            ideaText += `추가 요청사항: ${formData.additionalRequests}`;
        }
        
        return ideaText;
    }
    
    async function sendConsultationEmail(formData, prdResult) {
        const emailData = {
            type: 'consultation_request',
            clientInfo: {
                name: formData.contactName,
                email: formData.contactEmail,
                phone: formData.contactPhone,
                company: formData.companyName,
                team: formData.teamName || '미입력',
                jobTitle: formData.jobTitle || '미입력',
                consultationTime: formData.consultationTime,
                additionalRequests: formData.additionalRequests || '없음'
            },
            businessInfo: {
                idea: formData.businessIdea,
                targetUsers: formData.targetUsers,
                keyFeatures: formData.keyFeatures || '미입력',
                budgetTimeline: formData.budgetTimeline || '미입력'
            },
            prdResult: prdResult,
            submittedAt: new Date().toISOString()
        };
        
        const response = await fetch('/api/send-consultation-email', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(emailData)
        });
        
        if (!response.ok) {
            throw new Error(`이메일 발송 실패: ${response.statusText}`);
        }
        
        return await response.json();
    }
    
    function setSubmitLoading(loading) {
        submitBtn.disabled = loading;
        
        if (loading) {
            btnText.style.display = 'none';
            btnLoading.style.display = 'flex';
        } else {
            btnText.style.display = 'inline';
            btnLoading.style.display = 'none';
        }
    }
    
    function showSuccessMessage() {
        // 성공 페이지로 리다이렉트
        window.location.href = 'thank-you.html';
    }
    
    function showErrorMessage(message) {
        alert(`오류가 발생했습니다: ${message}\n\n잠시 후 다시 시도해주세요.`);
    }
});

// 페이지 애니메이션
window.addEventListener('load', function() {
    document.body.style.opacity = '0';
    document.body.style.transition = 'opacity 0.3s ease';
    setTimeout(() => {
        document.body.style.opacity = '1';
    }, 100);
}); 