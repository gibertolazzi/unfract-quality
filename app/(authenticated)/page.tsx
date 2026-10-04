import React from "react";
import { TaskBoard } from "@/components/tasks/TaskBoard";

export const dynamic = 'force-dynamic';

export default function UnfractPage() {
  return (
    <div className="h-full">
      <TaskBoard />
    </div>
  );
}
