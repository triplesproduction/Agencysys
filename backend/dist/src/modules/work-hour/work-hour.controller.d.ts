import { WorkHourService } from './work-hour.service';
import { CreateWorkHourDto } from './dto/work-hour.dto';
export declare class WorkHourController {
    private readonly workHourService;
    constructor(workHourService: WorkHourService);
    logWorkHours(user: any, createWorkHourDto: CreateWorkHourDto): Promise<{
        id: string;
        description: string | null;
        date: Date;
        hoursLogged: number;
        loggedAt: Date;
        employeeId: string;
        taskId: string | null;
    }>;
}
