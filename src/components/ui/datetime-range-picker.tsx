import { startOfDay, endOfDay, subDays } from "date-fns"
import { CalendarDays, Calendar as CalendarIcon, Clock2 } from "lucide-react"

import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { DateTimePicker } from "@/components/ui/datetime-picker"

interface DateTimeRangePickerProps {
  startDate?: Date
  endDate?: Date
  onStartDateChange: (date: Date | undefined) => void
  onEndDateChange: (date: Date | undefined) => void
  className?: string
  showShortcuts?: boolean
}

export function DateTimeRangePicker({
  startDate,
  endDate,
  onStartDateChange,
  onEndDateChange,
  className,
  showShortcuts = true,
}: DateTimeRangePickerProps) {

  const handleShortcut = (type: 'today' | 'last7days' | 'last30days') => {
    const now = new Date()

    switch (type) {
      case 'today':
        // Hoje: 00:00:00 até 23:59:59
        onStartDateChange(startOfDay(now))
        onEndDateChange(endOfDay(now))
        break

      case 'last7days':
        // Últimos 7 dias completos (incluindo hoje)
        onStartDateChange(startOfDay(subDays(now, 6)))
        onEndDateChange(endOfDay(now))
        break

      case 'last30days':
        // Últimos 30 dias completos (incluindo hoje)
        onStartDateChange(startOfDay(subDays(now, 29)))
        onEndDateChange(endOfDay(now))
        break
    }
  }

  return (
    <div className={cn("space-y-3", className)}>
      {showShortcuts && (
        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => handleShortcut('today')}
            className="h-8 text-xs"
          >
            <CalendarDays className="mr-2 h-3 w-3" />
            Hoje
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => handleShortcut('last7days')}
            className="h-8 text-xs"
          >
            <CalendarIcon className="mr-2 h-3 w-3" />
            Últimos 7 dias
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => handleShortcut('last30days')}
            className="h-8 text-xs"
          >
            <Clock2 className="mr-2 h-3 w-3" />
            Últimos 30 dias
          </Button>
        </div>
      )}

      <div className="flex flex-wrap gap-3">
        <div className="space-y-1 w-full md:w-auto md:max-w-[420px]">
          <label className="text-xs font-medium text-muted-foreground">
            Data/Hora Inicial
          </label>
          <DateTimePicker
            date={startDate}
            setDate={onStartDateChange}
            placeholder="Data inicial"
          />
        </div>

        <div className="space-y-1 w-full md:w-auto md:max-w-[420px]">
          <label className="text-xs font-medium text-muted-foreground">
            Data/Hora Final
          </label>
          <DateTimePicker
            date={endDate}
            setDate={onEndDateChange}
            placeholder="Data final"
          />
        </div>
      </div>
    </div>
  )
}
