import { useCallback, useEffect, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { PluelyApiSetup, Usage } from "./components";
import { PageLayout } from "@/layouts";
import { useApp } from "@/contexts";

const Dashboard = () => {
  const { pluelyApiEnabled } = useApp();
  const [activity, setActivity] = useState<any>(null);
  const [loadingActivity, setLoadingActivity] = useState(false);

  const fetchActivity = useCallback(async () => {
    if (!pluelyApiEnabled) {
      setActivity({ data: [], total_tokens_used: 0 });
      return;
    }
    setLoadingActivity(true);
    try {
      const response = await invoke("get_activity");
      const responseData: any = response;
      if (responseData && responseData.success) {
        setActivity(responseData);
      } else {
        setActivity({ data: [], total_tokens_used: 0 });
      }
    } catch (error) {
      setActivity({ data: [], total_tokens_used: 0 });
    } finally {
      setLoadingActivity(false);
    }
  }, [pluelyApiEnabled]);

  useEffect(() => {
    if (pluelyApiEnabled) {
      fetchActivity();
    } else {
      setActivity(null);
    }
  }, [fetchActivity, pluelyApiEnabled]);

  const activityData =
    activity && Array.isArray(activity.data) ? activity.data : [];
  const totalTokens =
    activity && typeof activity.total_tokens_used === "number"
      ? activity.total_tokens_used
      : 0;

  return (
    <PageLayout
      title="Dashboard"
      description="Monitor your usage and manage API preferences."
    >
      {/* Pluely API Setup */}
      <PluelyApiSetup />

      <Usage
        loading={loadingActivity}
        onRefresh={fetchActivity}
        data={activityData}
        totalTokens={totalTokens}
      />
    </PageLayout>
  );
};

export default Dashboard;
