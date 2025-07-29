import * as React from "react";
import { NavMain } from "@/features/navigation/components/Sidebar/nav-main";
import { NavUser } from "@/features/navigation/components/Sidebar/nav-user";
import { TeamSwitcher } from "@/features/navigation/components/Sidebar/team-switcher";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarRail,
} from "@/components/ui/sidebar";
import { FeedbackButton } from "./feedback-button";

export function AppSidebar({ ...props }: React.ComponentProps<typeof Sidebar>) {
  return (
    <Sidebar collapsible="icon" className="bg-primary" {...props} variant="sidebar">
      <SidebarHeader>
        <TeamSwitcher />
      </SidebarHeader>
      <SidebarContent>
        <NavMain />
      </SidebarContent>
      <SidebarFooter>
        <div className="flex flex-col gap-4">
          <FeedbackButton /> 
          <NavUser />
        </div>
      </SidebarFooter>
      <SidebarRail />
    </Sidebar>
  );
}