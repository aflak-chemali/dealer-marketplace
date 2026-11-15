"use server";

import { BookingStatusEnum as BookingStatus } from "@/enums/booking-status";
import { CarStatusEnum as CarStatus } from "@/enums/car-status";
import { getLogger } from "@/lib/logger";
import { ensureDealerUser } from "@/lib/supabase/ensure-dealer-user";
import type { ActionResponse } from "@/types/common/action-response";
import type { DashboardData } from "@/types/common/dashboard-data";

const log = getLogger(["app", "actions", "admin"]);

/**
 * Calculates KPIs for admin dashboard.
 * Aggregates car inventory stats and test drive metrics.
 * Computes conversion rate from completed test drives to sales.
 *
 * @returns Dashboard data with car and test drive statistics
 * @see DashboardData - Type for dashboard metrics
 */
export async function getDashboardData(): Promise<
  ActionResponse<DashboardData>
> {
  log.debug("Fetching dashboard data");
  try {
    const { supabase, dealerId, isSuperAdmin } = await ensureDealerUser();

    const carsQuery = supabase.from("Car").select("id, status, featured");
    const testDrivesQuery = supabase
      .from("TestDriveBooking")
      .select("id, status, carId");

    // Dealers only see their own KPIs; platform admins see everything
    const [carsResult, testDrivesResult] = await Promise.all([
      isSuperAdmin ? carsQuery : carsQuery.eq("dealerId", dealerId),
      isSuperAdmin ? testDrivesQuery : testDrivesQuery.eq("dealerId", dealerId),
    ]);

    const cars = carsResult.data || [];
    const testDrives = testDrivesResult.data || [];

    const totalCars = cars.length;
    const availableCars = cars.filter(
      (car) => car.status === CarStatus.AVAILABLE,
    ).length;
    const soldCars = cars.filter((car) => car.status === CarStatus.SOLD).length;
    const unavailableCars = cars.filter(
      (car) => car.status === CarStatus.UNAVAILABLE,
    ).length;
    const featuredCars = cars.filter((car) => car.featured === true).length;

    const totalTestDrives = testDrives.length;
    const pendingTestDrives = testDrives.filter(
      (td) => td.status === BookingStatus.PENDING,
    ).length;
    const confirmedTestDrives = testDrives.filter(
      (td) => td.status === BookingStatus.CONFIRMED,
    ).length;
    const completedTestDrives = testDrives.filter(
      (td) => td.status === BookingStatus.COMPLETED,
    ).length;
    const cancelledTestDrives = testDrives.filter(
      (td) => td.status === BookingStatus.CANCELLED,
    ).length;
    const noShowTestDrives = testDrives.filter(
      (td) => td.status === BookingStatus.NO_SHOW,
    ).length;

    const completedTestDriveCarIds = testDrives
      .filter((td) => td.status === BookingStatus.COMPLETED)
      .map((td) => td.carId);

    const soldCarsAfterTestDrive = cars.filter(
      (car) =>
        car.status === CarStatus.SOLD &&
        completedTestDriveCarIds.includes(car.id),
    ).length;

    const conversionRate =
      completedTestDrives > 0
        ? (soldCarsAfterTestDrive / completedTestDrives) * 100
        : 0;

    return {
      success: true,
      data: {
        cars: {
          total: totalCars,
          available: availableCars,
          sold: soldCars,
          unavailable: unavailableCars,
          featured: featuredCars,
        },
        testDrives: {
          total: totalTestDrives,
          pending: pendingTestDrives,
          confirmed: confirmedTestDrives,
          completed: completedTestDrives,
          cancelled: cancelledTestDrives,
          noShow: noShowTestDrives,
          conversionRate: parseFloat(conversionRate.toFixed(2)),
        },
      },
    };
  } catch (error) {
    log.error("Error fetching dashboard data: {error}", {
      error: (error as Error).message,
    });
    return {
      success: false,
      error: (error as Error).message,
    };
  }
}
