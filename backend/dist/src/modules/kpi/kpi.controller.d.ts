import { KpiService } from './kpi.service';
export declare class KpiController {
    private readonly kpiService;
    constructor(kpiService: KpiService);
    getEmployeeKPIs(employeeId: string): Promise<{
        id: string;
        employeeId: string;
        metricName: string;
        targetValue: number;
        currentValue: number;
        period: string;
        lastUpdated: Date;
    }[]>;
    triggerKpiCalculation(): Promise<{
        message: string;
        timestamp: string;
    }>;
}
