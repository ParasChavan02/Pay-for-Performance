import { ServiceModel } from '../services/service.model';
import { monitoringService } from './monitoring.service';

export class MonitoringScheduler {
  private activeJobs = new Map<string, NodeJS.Timeout>();
  private inFlightChecks = new Set<string>();
  private isRunning = false;

  /**
   * Initializes and starts background monitoring for all active services.
   */
  async start(): Promise<void> {
    if (this.isRunning) return;
    this.isRunning = true;

    try {
      const activeServices = await ServiceModel.find({ status: 'Active' }).lean();
      for (const service of activeServices) {
        this.scheduleService(service);
      }
      console.info(
        `Monitoring scheduler started. Scheduled ${this.activeJobs.size} active service(s).`
      );
    } catch (error) {
      console.warn('Monitoring scheduler encountered error loading services from database:', error);
    }
  }

  /**
   * Cleans up all active timer jobs and stops the scheduler.
   */
  stop(): void {
    for (const [, timer] of this.activeJobs.entries()) {
      clearInterval(timer);
    }
    this.activeJobs.clear();
    this.inFlightChecks.clear();
    this.isRunning = false;
  }

  /**
   * Schedules periodic monitoring checks for a specific active service.
   */
  scheduleService(service: { _id: { toString(): string } | string; monitoringInterval?: number; status?: string }): void {
    if (service.status !== 'Active') {
      return;
    }

    const serviceId = String(service._id);

    // Prevent duplicate timers for the same service
    this.unscheduleService(serviceId);

    const intervalSeconds = Math.max(1, service.monitoringInterval || 60);
    const intervalMs = intervalSeconds * 1000;

    const timer = setInterval(async () => {
      await this.runScheduledCheck(serviceId);
    }, intervalMs);

    if (timer.unref) {
      timer.unref();
    }

    this.activeJobs.set(serviceId, timer);
  }

  /**
   * Unschedules periodic monitoring checks for a service.
   */
  unscheduleService(serviceId: string): void {
    const existing = this.activeJobs.get(serviceId);
    if (existing) {
      clearInterval(existing);
      this.activeJobs.delete(serviceId);
    }
  }

  /**
   * Reschedules monitoring for a service based on its updated status or interval.
   */
  rescheduleService(service: { _id: { toString(): string } | string; monitoringInterval?: number; status?: string }): void {
    const serviceId = String(service._id);
    this.unscheduleService(serviceId);
    if (service.status === 'Active') {
      this.scheduleService(service);
    }
  }

  /**
   * Runs an isolated scheduled check, preventing overlapping checks for the same service.
   */
  async runScheduledCheck(serviceId: string): Promise<void> {
    if (this.inFlightChecks.has(serviceId)) {
      // Avoid overlapping checks for the same service
      return;
    }

    this.inFlightChecks.add(serviceId);
    try {
      await monitoringService.checkService(serviceId, 'Scheduled');
    } catch (error) {
      console.warn(`Scheduled check failed for service ${serviceId}: ${(error as Error).message}`);
    } finally {
      this.inFlightChecks.delete(serviceId);
    }
  }

  isInFlight(serviceId: string): boolean {
    return this.inFlightChecks.has(serviceId);
  }

  setInFlight(serviceId: string, inFlight: boolean): void {
    if (inFlight) {
      this.inFlightChecks.add(serviceId);
    } else {
      this.inFlightChecks.delete(serviceId);
    }
  }

  getActiveJobCount(): number {
    return this.activeJobs.size;
  }

  isSchedulerRunning(): boolean {
    return this.isRunning;
  }
}

export const monitoringScheduler = new MonitoringScheduler();
