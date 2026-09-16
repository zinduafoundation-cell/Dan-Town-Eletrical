import { createAutomationJob } from "@dantown/database";
import { createSupabaseServiceClient } from "@/lib/supabase/server";export type AutomationEventInput = {workflowName : string;source : string;sourceReference?: string | null;payload : unknown;
};export async function persistAutomationEvent(input : AutomationEventInput) {const supabase = createSupabaseServiceClient();return createAutomationJob(supabase, {workflowName : input.workflowName,source : input.source,sourceReference : input.sourceReference ?? null,payload : input.payload});
}
