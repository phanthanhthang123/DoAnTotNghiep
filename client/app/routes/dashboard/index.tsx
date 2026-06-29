import React from 'react'
import { useNavigate, useSearchParams } from 'react-router';
import { useGetWorkspaceQuery, useGetWorkspaceStatsQuery } from '@/hooks/use-workspace';
import { Loader } from '@/components/loader';
import { NoDataFound } from '@/components/workspace/no-data-found';
import { StatCard } from '@/components/dashboard/stat-card';
import { StatisticsCharts } from '@/components/dashboard/statistics-charts';
import { useAuth } from '@/provider/auth-context';

const DashBoard = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  
  // Get all workspaces this user is member of
  const { data: workspaces, isLoading: isLoadingWorkspaces } = useGetWorkspaceQuery(user?.id || "");

  const savedWorkspaceId =
    typeof window !== "undefined" ? localStorage.getItem("selectedWorkspaceId") || "" : "";
  const workspaceIdFromParams = searchParams.get('workspaceId');

  // Verify that the requested workspaceId is valid for the current user
  const userWorkspaceIds = workspaces?.map(ws => ws.id) || [];
  
  let workspaceId = "";
  if (workspaceIdFromParams && userWorkspaceIds.includes(workspaceIdFromParams)) {
    workspaceId = workspaceIdFromParams;
  } else if (savedWorkspaceId && userWorkspaceIds.includes(savedWorkspaceId)) {
    workspaceId = savedWorkspaceId;
  } else if (userWorkspaceIds.length > 0) {
    workspaceId = userWorkspaceIds[0];
  }

  const { data, isLoading: isLoadingStats } = useGetWorkspaceStatsQuery(workspaceId);

  if (isLoadingWorkspaces || (workspaceId && isLoadingStats)) {
    return <Loader />
  }

  if (!workspaceId) {
    return (
      <NoDataFound
        title="Bạn chưa tham gia không gian làm việc nào"
        description="Hãy tạo mới không gian làm việc hoặc yêu cầu Leader/Admin thêm bạn vào để xem dữ liệu thống kê."
        buttonText="Đi tới danh sách không gian"
        buttonAction={() => navigate("/workspaces")}
      />
    );
  }
  // Type assertion for workspace stats response
  type WorkspaceStatsData = {
    stats?: any;
    taskTrendsData?: any[];
    projectStatusData?: any[];
    taskPriorityData?: any[];
    workspaceProductivityData?: any[];
    upcomingTasks?: any[];
    recentTasks?: any[];
    recentProjects?: any[];
  };
  
  const statsData = (data as WorkspaceStatsData | undefined);
  
  return (
    <div className='space-y-8 2xl:space-y-12'>
      <div className='flex items-center justify-between'>
        <h1 className='text-2xl md:text-4xl font-bold'>Bảng Điều Khiển</h1>
      </div>

      <StatCard data={statsData?.stats}/>

      {/* TODO: Import and add StatisticsCharts component */}
      {statsData && (
        <StatisticsCharts
          stats={statsData?.stats}
          taskTrendsData={statsData?.taskTrendsData}
          projectStatusData={statsData?.projectStatusData}
          taskPriorityData={statsData?.taskPriorityData}
          workspaceProductivityData={statsData?.workspaceProductivityData}
        />
      )}
    </div>
  )
}

export default DashBoard