import React, { useState, useMemo, useEffect, useCallback } from 'react';

// This file is a web (React DOM) port of the original React Native screen.
// It uses localStorage for persistence and the browser download API to
// export report files.



/**
* =====================================================
* 시스템 상수 정의
* =====================================================
*/

const STORAGE_KEY = '@CM_REPORT_HISTORY_v7';

const MAX_HISTORY_COUNT = 50;

const UTF8_BOM = '\uFEFF';


/**
* =====================================================
* 2026년 CM 기준 데이터
* =====================================================
*/

const CM_STANDARD_2026 = {

    /**
     * 공사비 기준
     * 단위 : 억원
     */
    masterCost: [
        10, 30, 50, 70,
        100, 150, 200,
        300, 400, 500,
        700, 1000
    ],

    /**
     * 평균공기 기준
     * 단위 : 개월
     */
    masterDuration: [
        10, 14, 17, 24,
        28, 30, 37,
        38, 38, 39,
        45, 54
    ],

    /**
     * 보통인부 노임단가
     */
    commonLaborWage:
        172068,

    /**
     * 직접경비율
     */
    directExpenseRate: {

        officeExpense: 0.05,
        travelExpense: 0.04,
        printingExpense: 0.02,
        miscExpense: 0.04
    },

    /**
     * 부가세율
     */
    vatRate: 0.10
};


/**
* =====================================================
* 공통 유틸 함수
* =====================================================
*/

/**
* 숫자 포맷
*/
const formatNumber = (
    value
) => {

    if (
        value === undefined ||
        value === null ||
        isNaN(value)
    ) {

        return '0';
    }

    return Number(value)
        .toLocaleString('ko-KR');
};


/**
* 숫자 입력 정리
*/
const sanitizeNumericInput = (
    value
) => {

    return value
        .replace(/[^0-9.]/g, '')
        .replace(
            /(\..*)\./g,
            '$1'
        );
};


/**
* 공사비 문자열 → 숫자
*/
const parseCostValue = (
    value
) => {

    if (!value) {

        return NaN;
    }

    const cleaned =
        value
            .replace(/,/g, '')
            .trim();

    if (
        !/^\d+(\.\d+)?$/.test(cleaned)
    ) {

        return NaN;
    }

    return Number(cleaned);
};


/**
* 파일명 안전 처리
*/
const sanitizeFileName = (
    value
) => {

    return value.replace(
        /[^a-zA-Z0-9가-힣]/g,
        '_'
    );
};


/**
* =====================================================
* CM 대가산출 엔진
* =====================================================
*/

class CMTotalReportBinder {
    constructor() {
        this.standard = CM_STANDARD_2026;
    }


    /**
     * 공사비 검증
     */
    validateProjectCost(
        projectCost
    ) {

        if (
            typeof projectCost !== 'number' ||
            isNaN(projectCost)
        ) {

            throw new Error(
                '공사비는 숫자여야 합니다.'
            );
        }

        if (projectCost <= 0) {

            throw new Error(
                '공사비는 0보다 커야 합니다.'
            );
        }
    }


    /**
     * 직선보간 평균공기 계산
     */
    getAverageDuration(
        projectCost
    ) {

        this.validateProjectCost(
            projectCost
        );

        const {
            masterCost,
            masterDuration
        } = this.standard;

        /**
         * 최소값 이하
         */
        if (
            projectCost <=
            masterCost[0]
        ) {

            return masterDuration[0];
        }

        /**
         * 최대값 이상
         */
        if (
            projectCost >=
            masterCost[
                masterCost.length - 1
            ]
        ) {

            return masterDuration[
                masterDuration.length - 1
            ];
        }

        /**
         * 직선보간 계산
         */
        for (
            let i = 0;
            i < masterCost.length - 1;
            i++
        ) {

            const x1 =
                masterCost[i];

            const x2 =
                masterCost[i + 1];

            const y1 =
                masterDuration[i];

            const y2 =
                masterDuration[i + 1];

            if (
                projectCost >= x1 &&
                projectCost <= x2
            ) {

                const duration =
                    y1 +
                    (
                        (
                            projectCost - x1
                        ) *
                        (
                            y2 - y1
                        )
                    ) /
                    (
                        x2 - x1
                    );

                return Number(
                    duration.toFixed(2)
                );
            }
        }

        return 0;
    }


    /**
     * 평균공기 산출 근거 설명(구간, 보간식 반환)
     */
    getAverageDurationExplanation(projectCost) {

        this.validateProjectCost(projectCost);

        const {
            masterCost,
            masterDuration
        } = this.standard;

        if (projectCost <= masterCost[0]) {
            return {
                type: 'min',
                projectCost,
                x1: masterCost[0],
                y1: masterDuration[0],
                result: masterDuration[0],
                text: '최소값 이하로 기준 최소 평균공기를 적용합니다.'
            };
        }

        if (
            projectCost >=
            masterCost[masterCost.length - 1]
        ) {
            return {
                type: 'max',
                projectCost,
                x2: masterCost[masterCost.length - 1],
                y2: masterDuration[masterDuration.length - 1],
                result: masterDuration[masterDuration.length - 1],
                text: '최대값 이상으로 기준 최대 평균공기를 적용합니다.'
            };
        }

        for (let i = 0; i < masterCost.length - 1; i++) {
            const x1 = masterCost[i];
            const x2 = masterCost[i + 1];
            const y1 = masterDuration[i];
            const y2 = masterDuration[i + 1];

            if (projectCost >= x1 && projectCost <= x2) {
                const duration =
                    y1 +
                    (((projectCost - x1) * (y2 - y1)) / (x2 - x1));

                return {
                    type: 'interpolate',
                    projectCost,
                    x1,
                    x2,
                    y1,
                    y2,
                    duration: Number(duration.toFixed(2)),
                    formula: 'y = y1 + ((x - x1) * (y2 - y1)) / (x2 - x1)',
                    text: '구간 보간(직선보간)을 통해 평균공기를 계산합니다.'
                };
            }
        }

        return {
            type: 'unknown',
            projectCost,
            result: null
        };
    }


    /**
     * 노무비 계산
     */
    calculateLaborCost(
        averageDuration
    ) {

        return (
            averageDuration *
            this.standard
                .commonLaborWage
        );
    }


    /**
     * 직접경비 계산
     */
    calculateDirectExpense(
        laborCost
    ) {

        const totalRate =
            Object.values(
                this.standard
                    .directExpenseRate
            ).reduce(
                (
                    sum,
                    rate
                ) => sum + rate,
                0
            );

        return (
            laborCost *
            totalRate
        );
    }


    /**
     * 부가세 계산
     */
    calculateVAT(
        amount
    ) {

        return (
            amount *
            this.standard
                .vatRate
        );
    }


    /**
     * 최종 산출
     */
    calculate(
        projectName,
        projectCost
    ) {

        const averageDuration =
            this.getAverageDuration(
                projectCost
            );

        const laborCost =
            this.calculateLaborCost(
                averageDuration
            );

        const directExpense =
            this.calculateDirectExpense(
                laborCost
            );

        const supplyAmount =
            laborCost +
            directExpense;

        const vat =
            this.calculateVAT(
                supplyAmount
            );

        const totalAmount =
            supplyAmount +
            vat;

        return {

            id:
                `${Date.now()}_${Math.random()
                    .toString(36)
                    .substring(2, 8)}`,

            projectName,

            projectCost,

            averageDuration,

            laborCost:
                Math.round(
                    laborCost
                ),

            directExpense:
                Math.round(
                    directExpense
                ),

            supplyAmount:
                Math.round(
                    supplyAmount
                ),

            vat:
                Math.round(
                    vat
                ),

            totalAmount:
                Math.round(
                    totalAmount
                ),

            createdAt:
                new Date()
                    .toLocaleString(
                        'ko-KR'
                    )
        };
    }
}


/**
* =====================================================
* 메인 화면
* =====================================================
*/

export default function CMScreen() {

    /**
     * 입력 상태
     */
    const [projectName, setProjectName] = useState('');
    const [projectCost, setProjectCost] = useState('');


    /**
     * 결과 상태
     */
    const [result, setResult] = useState(null);
    const [explanation, setExplanation] = useState(null);
    const [history, setHistory] = useState([]);



    /**
     * 자동 저장 여부
     */
    const [autoSaveEnabled, setAutoSaveEnabled] = useState(true);


    /**
     * 로딩 상태
     */
    const [loading, setLoading] = useState(false);



    /**
     * 엔진 메모이징
     */
    const engine = useMemo(() => new CMTotalReportBinder(), []);


    /**
     * 저장 이력 로드
     */
    const loadHistory = useCallback(() => {
        try {
            const stored = localStorage.getItem(STORAGE_KEY);

            if (!stored) {
                setHistory([]);
                return;
            }

            let parsed = [];

            try {
                parsed = JSON.parse(stored);
            } catch {
                parsed = [];
            }

            if (Array.isArray(parsed)) {
                setHistory(parsed);
            } else {
                setHistory([]);
            }
        } catch (error) {
            console.log('이력 로드 실패', error);
            setHistory([]);
        }
    }, []);



    /**
     * 최초 로드
     */
    useEffect(() => {
        loadHistory();
    }, [loadHistory]);


    // 새로고침은 웹에서 수동으로 로드 버튼으로 대체할 수 있으므로 상태 제거


    /**
     * 저장 이력 저장
     */
    const saveHistory = useCallback((report) => {
        try {
            const updatedHistory = [
                report,
                ...history.filter((item) => item.id !== report.id),
            ].slice(0, MAX_HISTORY_COUNT);

            setHistory(updatedHistory);
            localStorage.setItem(STORAGE_KEY, JSON.stringify(updatedHistory));
        } catch (error) {
            console.log('이력 저장 실패', error);
        }
    }, [history]);


    /**
     * 계산 실행
     */
    const handleCalculate = useCallback(() => {
        if (loading) return;

        try {
            setLoading(true);

            if (!projectName.trim()) {
                alert('사업명을 입력해주세요.');
                return;
            }

            const numericCost = parseCostValue(projectCost);

            if (isNaN(numericCost)) {
                alert('공사비 형식이 올바르지 않습니다.');
                return;
            }

            const report = engine.calculate(projectName.trim(), numericCost);
            const explanation = engine.getAverageDurationExplanation(numericCost);
            setResult(report);
            setExplanation(explanation);

            if (autoSaveEnabled) {
                saveHistory(report);
            }
        } catch (error) {
            alert(`계산 오류: ${error.message}`);
        } finally {
            setLoading(false);
        }
    }, [loading, engine, projectName, projectCost, autoSaveEnabled, saveHistory]);


    /**
     * 리포트 텍스트 생성기 (파일 저장 및 복사에 재사용)
     */
    const buildReportText = useCallback((reportData) => {
        if (!reportData) return '';

        return (
            UTF8_BOM +
            `[CM 대가산출 결과]\n\n` +
            `사업명 : ${reportData.projectName}\n` +
            `공사비 : ${formatNumber(reportData.projectCost)} 억원\n` +
            `평균공기 : ${reportData.averageDuration} 개월\n` +
            `노무비 : ${formatNumber(reportData.laborCost)} 원\n` +
            `직접경비 : ${formatNumber(reportData.directExpense)} 원\n` +
            `공급가액 : ${formatNumber(reportData.supplyAmount)} 원\n` +
            `부가가치세 : ${formatNumber(reportData.vat)} 원\n` +
            `총 합계 : ${formatNumber(reportData.totalAmount)} 원\n` +
            `생성일시 : ${reportData.createdAt}\n`
        );
    }, []);


    const handleExport = useCallback((reportData = result) => {
        try {
            if (!reportData) {
                alert('저장할 데이터가 없습니다.');
                return;
            }

            const safeName = sanitizeFileName(reportData.projectName || 'report');
            const reportText = buildReportText(reportData);

            const blob = new Blob([reportText], { type: 'text/plain;charset=utf-8' });
            const url = URL.createObjectURL(blob);

            const a = document.createElement('a');
            a.href = url;
            a.download = `${safeName}_CM_Report.txt`;
            document.body.appendChild(a);
            a.click();
            a.remove();
            URL.revokeObjectURL(url);
        } catch (error) {
            alert(`파일 오류: ${error.message}`);
        }
    }, [result, buildReportText]);


    // 복사 상태 표시
    const [copyStatus, setCopyStatus] = useState('');

    const handleCopy = useCallback(async (reportData = result) => {
        if (!reportData) {
            alert('복사할 데이터가 없습니다.');
            return;
        }

        try {
            const text = buildReportText(reportData);
            await navigator.clipboard.writeText(text);
            setCopyStatus('복사됨');
            setTimeout(() => setCopyStatus(''), 2000);
        } catch (err) {
            alert(`복사 실패: ${err.message}`);
        }
    }, [result, buildReportText]);


    /**
     * 저장 이력 삭제
     */
    const clearHistory = useCallback(() => {
        try {
            localStorage.removeItem(STORAGE_KEY);
            setHistory([]);
            alert('저장 이력이 삭제되었습니다.');
        } catch (error) {
            alert(`삭제 오류: ${error.message}`);
        }
    }, []);



    /**
     * 저장 이력 렌더링
     */
    const renderHistoryItem = ({ item }) => (
        <div className="historyItem" key={item.id}>
            <div className="historyTitle">{item.projectName}</div>
            <div className="historyText">공사비 : {formatNumber(item.projectCost)} 억원</div>
            <div className="historyText">총 합계 : {formatNumber(item.totalAmount)} 원</div>
            <button className="smallButton" onClick={() => handleExport(item)}>결과 저장</button>
        </div>
    );


    return (
        <div className="safeArea">
            <div className="container">
                <div className="scrollContainer">
                    <h1 className="title">CM 대가산출 시스템</h1>

                    <div className="switchRow">
                        <div className="label">자동 저장</div>
                        <input type="checkbox" checked={autoSaveEnabled} onChange={(e) => setAutoSaveEnabled(e.target.checked)} />
                    </div>

                    <input className="input" placeholder="사업명" value={projectName} onChange={(e) => setProjectName(e.target.value)} />

                    <input className="input" placeholder="공사비 (억원)" value={projectCost} onChange={(e) => setProjectCost(sanitizeNumericInput(e.target.value))} />

                    <button className={`button ${loading ? 'buttonDisabled' : ''}`} onClick={handleCalculate} disabled={loading}>
                        {loading ? '처리중...' : '대가 산출 실행'}
                    </button>

                    {result && (
                        <div className="resultBox improved">
                            <div className="resultTitle">산출 결과</div>

                            <div className="resultGrid">
                                <div className="resultCard">
                                    <div className="cardLabel">사업명</div>
                                    <div className="cardValue">{result.projectName}</div>
                                </div>

                                <div className="resultCard">
                                    <div className="cardLabel">공사비</div>
                                    <div className="cardValue">{formatNumber(result.projectCost)} 억원</div>
                                </div>

                                <div className="resultCard">
                                    <div className="cardLabel">평균공기</div>
                                    <div className="cardValue">{result.averageDuration} 개월</div>
                                </div>

                                <div className="resultCard highlight">
                                    <div className="cardLabel">총 합계</div>
                                    <div className="cardValue large">{formatNumber(result.totalAmount)} 원</div>
                                </div>
                            </div>

                            <div className="resultActions">
                                <button className="exportButton" onClick={() => handleExport()}>파일로 저장</button>
                                <button className="smallButton" onClick={() => handleCopy()}>{copyStatus || '결과 복사'}</button>
                                <button className="smallButton" onClick={() => saveHistory(result)}>이력 저장</button>
                            </div>

                            {explanation && (
                                <div className="explanationBox">
                                    <div className="explanationTitle">산출 근거</div>
                                    <div className="explanationContent">
                                        <div><strong>방법:</strong> {explanation.text}</div>
                                        {explanation.type === 'interpolate' && (
                                            <div>
                                                <div><strong>구간:</strong> {explanation.x1}억 ~ {explanation.x2}억</div>
                                                <div><strong>공식:</strong> {explanation.formula}</div>
                                                <div><strong>계산 예:</strong> y1={explanation.y1}, y2={explanation.y2}, x={explanation.projectCost} ⇒ 평균공기={explanation.duration} 개월</div>
                                            </div>
                                        )}
                                        {explanation.type === 'min' && (
                                            <div>최소 기준({explanation.x1}억) 평균공기 {explanation.y1} 개월을 적용했습니다.</div>
                                        )}
                                        {explanation.type === 'max' && (
                                            <div>최대 기준({explanation.x2}억) 평균공기 {explanation.y2} 개월을 적용했습니다.</div>
                                        )}
                                    </div>
                                </div>
                            )}
                        </div>
                    )}

                    {history.length > 0 && (
                        <button className="clearButton" onClick={clearHistory}>저장 이력 삭제</button>
                    )}

                    <div className="historyHeader">저장 이력</div>

                    <div className="historyList">
                        {history.length === 0 && <div className="historyEmpty">저장된 이력이 없습니다.</div>}
                        {history.map((item) => (
                            <div key={item.id} className="historyRow">
                                <div>
                                    <div className="historyTitle">{item.projectName}</div>
                                    <div className="historyText">공사비: {formatNumber(item.projectCost)} 억원 · 총: {formatNumber(item.totalAmount)} 원</div>
                                </div>
                                <div style={{display: 'flex', gap: 8}}>
                                    <button className="smallButton" onClick={() => setResult(item)}>불러오기</button>
                                    <button className="smallButton" onClick={() => handleExport(item)}>저장</button>
                                </div>
                            </div>
                        ))}
                    </div>
                    <div style={{marginTop: 24, fontSize: 13, color: '#666'}}>
                        수정 필요 사항이 있으면 <a href="mailto:kyoungbin1996@gmail.com">kyoungbin1996@gmail.com</a> 으로 연락해주세요.
                    </div>
                </div>
            </div>
        </div>
    );
}


// Styles handled via CSS in App.css for the web build.
