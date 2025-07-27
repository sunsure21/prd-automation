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
    
    // 자동 저장 기능 초기화
    initAutoSave();
    
    // 저장된 데이터 복원
    restoreFormData();
    
    // 폼 제출 이벤트
    form.addEventListener('submit', handleFormSubmit);
    
    // 폼 구조 검증
    const formGroups = form.querySelectorAll('.form-group');
    const inputs = form.querySelectorAll('input, textarea, select');
    console.log('📋 폼 구조 검증:', {
        formGroups: formGroups.length,
        inputs: inputs.length,
        form: !!form
    });
    
    // 누락된 form-group 찾기
    inputs.forEach((input, index) => {
        const formGroup = input.closest('.form-group');
        if (!formGroup) {
            console.warn(`⚠️ 인덱스 ${index}의 입력 요소에 .form-group이 없습니다:`, input);
        }
    });
    
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
        if (!formGroup) {
            console.warn('⚠️ .form-group을 찾을 수 없습니다:', field);
            return true; // 검증할 수 없으면 통과시킴
        }
        
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
        if (checkboxes.length === 0) {
            console.warn('⚠️ consultationTime 체크박스를 찾을 수 없습니다');
            return true;
        }
        
        const checked = Array.from(checkboxes).some(cb => cb.checked);
        const formGroup = checkboxes[0].closest('.form-group');
        
        if (!formGroup) {
            console.warn('⚠️ consultationTime .form-group을 찾을 수 없습니다');
            return true;
        }
        
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
        if (!formGroup) {
            console.warn('⚠️ .form-group을 찾을 수 없습니다:', field);
            return;
        }
        
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
        if (!formGroup) {
            console.warn('⚠️ .form-group을 찾을 수 없습니다:', field);
            return;
        }
        
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
            
            // 📤 고객 설문 데이터만 서버로 전송 (즉시 처리)
            console.log('📤 설문 데이터 제출 중...');
            const response = await fetch('/api/submit-consultation-request', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    clientInfo: formData,
                    timestamp: new Date().toISOString()
                })
            });
            
            if (!response.ok) {
                throw new Error(`설문 제출 실패: ${response.statusText}`);
            }
            
            const result = await response.json();
            console.log('✅ 설문 제출 완료:', result);
            
            // 🎉 즉시 성공 처리 (PRD 생성은 백그라운드에서 진행)
            showSuccessMessage();
            
        } catch (error) {
            console.error('❌ 설문 제출 오류:', error);
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
        if (!privacyAgreement) {
            console.warn('⚠️ privacy-agreement 체크박스를 찾을 수 없습니다');
        } else if (!privacyAgreement.checked) {
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
    
    // 🚫 더 이상 사용하지 않는 함수들 (서버에서 백그라운드 처리)
    /*
    async function generatePRD(formData) {
        // 백그라운드에서 서버가 처리
    }
    
    function createIdeaText(formData) {
        // 서버에서 처리
    }
    
    async function sendConsultationEmail(formData, prdResult) {
        // 백그라운드에서 서버가 처리
    }
    */
    
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
        alert(`오류가 발생했습니다: ${message}\n\n작성하신 내용은 자동으로 저장되었습니다.\n페이지를 새로고침해도 복원됩니다.`);
    }
    
    // 자동 저장 기능 초기화
    function initAutoSave() {
        console.log('💾 자동 저장 기능 초기화');
        
        // 모든 입력 필드에 자동 저장 이벤트 추가
        const allInputs = form.querySelectorAll('input, textarea');
        allInputs.forEach(input => {
            input.addEventListener('input', debounce(saveFormData, 1000));
            input.addEventListener('change', saveFormData);
        });
        
        // 체크박스는 별도 처리
        const checkboxes = form.querySelectorAll('input[type="checkbox"]');
        checkboxes.forEach(checkbox => {
            checkbox.addEventListener('change', saveFormData);
        });
    }
    
    // 폼 데이터 저장
    function saveFormData() {
        try {
            const formData = collectFormData();
            localStorage.setItem('customerSurveyData', JSON.stringify({
                data: formData,
                timestamp: new Date().toISOString(),
                version: '1.0'
            }));
            console.log('💾 폼 데이터 자동 저장 완료');
        } catch (error) {
            console.error('💾 자동 저장 실패:', error);
        }
    }
    
    // 저장된 데이터 복원
    function restoreFormData() {
        try {
            const savedData = localStorage.getItem('customerSurveyData');
            if (!savedData) {
                console.log('💾 저장된 데이터 없음');
                return;
            }
            
            const { data, timestamp } = JSON.parse(savedData);
            console.log('💾 저장된 데이터 발견:', new Date(timestamp).toLocaleString());
            
            // 24시간 이내 데이터만 복원
            const saveTime = new Date(timestamp);
            const now = new Date();
            const hoursDiff = (now - saveTime) / (1000 * 60 * 60);
            
            if (hoursDiff > 24) {
                console.log('💾 저장된 데이터가 24시간 이상 경과하여 삭제');
                localStorage.removeItem('customerSurveyData');
                return;
            }
            
            // 사용자에게 복원 여부 확인
            const shouldRestore = confirm(
                `이전에 작성하던 내용이 있습니다.\n\n` +
                `저장 시간: ${saveTime.toLocaleString()}\n\n` +
                `복원하시겠습니까?`
            );
            
            if (shouldRestore) {
                fillFormData(data);
                console.log('✅ 폼 데이터 복원 완료');
                
                // 복원 알림
                setTimeout(() => {
                    showNotification('이전 작성 내용이 복원되었습니다.', 'success');
                }, 500);
            }
            
        } catch (error) {
            console.error('💾 데이터 복원 실패:', error);
            localStorage.removeItem('customerSurveyData');
        }
    }
    
    // 폼에 데이터 채우기
    function fillFormData(data) {
        // 텍스트 입력 필드
        Object.keys(data).forEach(key => {
            if (key === 'consultationTime') return; // 체크박스는 별도 처리
            
            const element = form.querySelector(`[name="${key}"]`);
            if (element && data[key]) {
                element.value = data[key];
                
                // 글자수 카운터 업데이트
                const counter = document.querySelector(`[data-target="${element.id}"]`);
                if (counter) {
                    updateCharCounter(element, counter);
                }
            }
        });
        
        // 체크박스 복원
        if (data.consultationTime && Array.isArray(data.consultationTime)) {
            data.consultationTime.forEach(time => {
                const checkbox = form.querySelector(`input[name="consultationTime"][value="${time}"]`);
                if (checkbox) {
                    checkbox.checked = true;
                }
            });
        }
        
        // 개인정보 동의 체크박스
        if (data.privacyAgreement) {
            const privacyCheckbox = form.querySelector('#privacy-agreement');
            if (privacyCheckbox) {
                privacyCheckbox.checked = true;
            }
        }
    }
    
    // 디바운스 함수 (너무 자주 저장되지 않도록)
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
    
    // 알림 표시 함수
    function showNotification(message, type = 'info') {
        // 기존 알림 제거
        const existingNotification = document.querySelector('.notification');
        if (existingNotification) {
            existingNotification.remove();
        }
        
        // 새 알림 생성
        const notification = document.createElement('div');
        notification.className = `notification notification-${type}`;
        notification.innerHTML = `
            <div class="notification-content">
                <span>${message}</span>
                <button class="notification-close" onclick="this.parentElement.parentElement.remove()">×</button>
            </div>
        `;
        
        // 스타일 추가
        const style = document.createElement('style');
        style.textContent = `
            .notification {
                position: fixed;
                top: 20px;
                right: 20px;
                background: white;
                border-radius: 8px;
                box-shadow: 0 4px 20px rgba(0,0,0,0.15);
                z-index: 10000;
                animation: slideIn 0.3s ease-out;
                max-width: 400px;
            }
            .notification-success { border-left: 4px solid #38a169; }
            .notification-error { border-left: 4px solid #e53e3e; }
            .notification-info { border-left: 4px solid #4299e1; }
            .notification-content {
                padding: 16px 20px;
                display: flex;
                align-items: center;
                justify-content: space-between;
                gap: 12px;
            }
            .notification-close {
                background: none;
                border: none;
                font-size: 18px;
                cursor: pointer;
                color: #666;
                padding: 0;
                width: 20px;
                height: 20px;
                display: flex;
                align-items: center;
                justify-content: center;
            }
            @keyframes slideIn {
                from { transform: translateX(100%); opacity: 0; }
                to { transform: translateX(0); opacity: 1; }
            }
        `;
        document.head.appendChild(style);
        
        // 문서에 추가
        document.body.appendChild(notification);
        
        // 5초 후 자동 제거
        setTimeout(() => {
            if (notification.parentElement) {
                notification.remove();
            }
        }, 5000);
    }
    
    // 성공 시 저장된 데이터 삭제
    function showSuccessMessage() {
        // 저장된 데이터 삭제
        localStorage.removeItem('customerSurveyData');
        console.log('💾 성공 후 저장된 데이터 삭제');
        
        // 성공 페이지로 리다이렉트
        window.location.href = 'thank-you.html';
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