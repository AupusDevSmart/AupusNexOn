// src/features/dashboard/components/task-priorities.tsx
import React from 'react';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';

interface Task {
  id: number;
  title: string;
  priority: 'urgent' | 'high' | 'medium' | 'low';
  status: string;
}

interface TaskPrioritiesProps {
  tasks: Task[];
}

export function TaskPriorities({ tasks }: TaskPrioritiesProps) {
  const getPriorityBadge = (priority: Task['priority']) => {
    const variants = {
      urgent: "bg-red-100 text-red-800 border-red-200 dark:bg-red-900/20 dark:text-red-400 dark:border-red-800",
      high: "bg-blue-100 text-blue-800 border-blue-200 dark:bg-blue-900/20 dark:text-blue-400 dark:border-blue-800",
      medium: "bg-amber-100 text-amber-800 border-amber-200 dark:bg-amber-900/20 dark:text-amber-400 dark:border-amber-800",
      low: "bg-gray-100 text-gray-800 border-gray-200 dark:bg-gray-900/20 dark:text-gray-400 dark:border-gray-800"
    };

    const labels = {
      urgent: "URGENTE",
      high: "ALTA",
      medium: "MÉDIA",
      low: "BAIXA"
    };

    return (
      <Badge variant="outline" className={variants[priority]}>
        {labels[priority]}
      </Badge>
    );
  };

  return (
    <Card className="p-6 h-full">
      <h3 className="text-lg font-semibold mb-6 text-foreground">
        Prioridades de Tarefas
      </h3>
      
      <div className="space-y-4">
        {tasks.map((task) => (
          <div key={task.id} className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
            <div className="flex-1 mr-3">
              <p className="text-sm text-foreground font-medium">
                {task.title}
              </p>
            </div>
            <div>
              {getPriorityBadge(task.priority)}
            </div>
          </div>
        ))}
      </div>
    </Card>
  );
}