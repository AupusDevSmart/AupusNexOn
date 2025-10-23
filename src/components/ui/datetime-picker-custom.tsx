import * as React from "react"
import { format } from "date-fns"
import { ptBR } from "date-fns/locale"
import { Calendar as CalendarIcon } from "lucide-react"

import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Calendar } from "@/components/ui/calendar"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import { TimePicker, TimePickerSplit, TimePickerPresets } from "@/components/ui/time-picker"

interface DateTimePickerCustomProps {
  date?: Date
  setDate: (date: Date | undefined) => void
  placeholder?: string
  className?: string
  timePickerVariant?: "default" | "split" | "presets"
}

export function DateTimePickerCustom({
  date,
  setDate,
  placeholder = "Selecione data e hora",
  className,
  timePickerVariant = "default",
}: DateTimePickerCustomProps) {
  const [selectedDate, setSelectedDate] = React.useState<Date | undefined>(date)
  const [timeValue, setTimeValue] = React.useState<string>(
    date ? format(date, "HH:mm") : "00:00"
  )

  React.useEffect(() => {
    if (date) {
      setSelectedDate(date)
      setTimeValue(format(date, "HH:mm"))
    } else {
      setSelectedDate(undefined)
      setTimeValue("00:00")
    }
  }, [date])

  const handleDateSelect = (newDate: Date | undefined) => {
    if (!newDate) {
      setSelectedDate(undefined)
      setDate(undefined)
      return
    }

    // Preservar o horário ao selecionar nova data
    const [hours, minutes] = timeValue.split(":").map(Number)
    const updatedDate = new Date(newDate)
    updatedDate.setHours(hours, minutes, 0, 0)

    setSelectedDate(updatedDate)
    setDate(updatedDate)
  }

  const handleTimeChange = (time: string) => {
    setTimeValue(time)

    if (!time) {
      return
    }

    const [hours, minutes] = time.split(":").map(Number)

    // Se não há data selecionada, criar uma com a data atual
    const dateToUpdate = selectedDate || new Date()
    const newDate = new Date(dateToUpdate)
    newDate.setHours(hours, minutes, 0, 0)

    setSelectedDate(newDate)
    setDate(newDate)
  }

  const renderTimePicker = () => {
    const commonProps = {
      value: timeValue,
      onChange: handleTimeChange,
      className: "flex-1",
    }

    switch (timePickerVariant) {
      case "split":
        return <TimePickerSplit {...commonProps} />
      case "presets":
        return <TimePickerPresets {...commonProps} />
      default:
        return <TimePicker {...commonProps} />
    }
  }

  return (
    <div className={cn("flex gap-2", className)}>
      <Popover>
        <PopoverTrigger asChild>
          <Button
            variant={"outline"}
            className={cn(
              "flex-1 justify-start text-left font-normal",
              !selectedDate && "text-muted-foreground"
            )}
          >
            <CalendarIcon className="mr-2 h-4 w-4" />
            {selectedDate ? (
              format(selectedDate, "PPP", { locale: ptBR })
            ) : (
              <span>{placeholder}</span>
            )}
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-auto p-0">
          <Calendar
            mode="single"
            selected={selectedDate}
            onSelect={handleDateSelect}
            initialFocus
            locale={ptBR}
          />
        </PopoverContent>
      </Popover>

      {renderTimePicker()}
    </div>
  )
}
