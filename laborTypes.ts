
export interface JobTemplate {
    id: string;
    name: string;
    type: 'CLT' | 'PJ';
    salaries: number[]; // 12 months
}

export interface LaborPosition {
    id: string;
    templateId: string;
    sectorId: string;
    isExcludedFromTotal: boolean;
    headcount: number[]; // 12 months
}

export interface LaborBenefit {
    id: string;
    name: string;
    accountCode: string;
    sectorId: string;
    method: 'driver' | 'absolute' | 'percent_increase' | 'absolute_increase';
    values: number[]; // 12 months
    lastYearValues: number[]; // 12 months
    increaseValue: number; // % or absolute
}

export interface LaborCharge {
    id: string;
    name: string;
    accountCode: string;
    sectorId: string;
    method: 'percent' | 'absolute';
    values: number[]; // 12 months (percentage or absolute)
}

export interface LaborDissidio {
    percentage: number;
    startMonth: number; // 1-12
}
