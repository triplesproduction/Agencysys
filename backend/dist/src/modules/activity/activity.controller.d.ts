import { ActivityService } from './activity.service';
export declare class ActivityController {
    private readonly activityService;
    constructor(activityService: ActivityService);
    findByEmployee(employeeId: string): Promise<{
        data: {
            id: string;
            employeeId: string;
            action: string;
            metadata: string | null;
            timestamp: Date;
        }[];
        message: string;
    }>;
}
