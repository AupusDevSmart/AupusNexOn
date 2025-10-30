import * as React from "react"
import { format, parse, isValid } from "date-fns"
import { ptBR } from "date-fns/locale"
import { Calendar as CalendarIcon, AlertCircle } from "lucide-react"

import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Calendar } from "@/components/ui/calendar"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip"

interface DateTimePickerProps {
  date?: Date
  setDate: (date: Date | undefined) => void
  placeholder?: string
  className?: string
}

export function DateTimePicker({
  date,
  setDate,
  placeholder = "dd/mm/aaaa",
  className,
}: DateTimePickerProps) {
  const [selectedDate, setSelectedDate] = React.useState<Date | undefined>(date)
  const [inputValue, setInputValue] = React.useState<string>(
    date ? format(date, "dd/MM/yyyy") : ""
  )
  const [isOpen, setIsOpen] = React.useState(false)
  const [isInvalid, setIsInvalid] = React.useState(false)
  const [errorMessage, setErrorMessage] = React.useState("")

  React.useEffect(() => {
    if (date) {
      setSelectedDate(date)
      setInputValue(format(date, "dd/MM/yyyy"))
      setIsInvalid(false)
      setErrorMessage("")
    } else {
      setSelectedDate(undefined)
      setInputValue("")
      setIsInvalid(false)
      setErrorMessage("")
    }
  }, [date])

  const handleDateSelect = (newDate: Date | undefined) => {
    if (!newDate) {
      setSelectedDate(undefined)
      setDate(undefined)
      setInputValue("")
      setIsInvalid(false)
      setErrorMessage("")
      return
    }

    // Define a hora como 00:00:00 para evitar problemas de timezone
    const updatedDate = new Date(newDate)
    updatedDate.setHours(0, 0, 0, 0)

    setSelectedDate(updatedDate)
    setDate(updatedDate)
    setInputValue(format(updatedDate, "dd/MM/yyyy"))
    setIsInvalid(false)
    setErrorMessage("")
    setIsOpen(false)
  }

  const formatDateInput = (value: string): string => {
    // Remove tudo que não é número
    const numbers = value.replace(/\D/g, "")

    // Formata conforme o usuário digita
    if (numbers.length <= 2) {
      return numbers
    } else if (numbers.length <= 4) {
      return `${numbers.slice(0, 2)}/${numbers.slice(2)}`
    } else {
      return `${numbers.slice(0, 2)}/${numbers.slice(2, 4)}/${numbers.slice(4, 8)}`
    }
  }

  const validateDate = (dateString: string): { isValid: boolean; message: string } => {
    // Se está vazio, não é erro
    if (dateString.length === 0) {
      return { isValid: true, message: "" }
    }

    // Se está incompleto
    if (dateString.length > 0 && dateString.length < 10) {
      return { isValid: false, message: "Data incompleta. Use o formato dd/mm/aaaa" }
    }

    // Se tem 10 caracteres, validar a data
    if (dateString.length === 10) {
      const parsedDate = parse(dateString, "dd/MM/yyyy", new Date())

      if (!isValid(parsedDate)) {
        return { isValid: false, message: "Data inválida" }
      }

      // Validações adicionais
      const parts = dateString.split("/")
      const day = parseInt(parts[0], 10)
      const month = parseInt(parts[1], 10)
      const year = parseInt(parts[2], 10)

      if (day < 1 || day > 31) {
        return { isValid: false, message: "Dia inválido. Use um valor entre 01 e 31" }
      }

      if (month < 1 || month > 12) {
        return { isValid: false, message: "Mês inválido. Use um valor entre 01 e 12" }
      }

      if (year < 1900 || year > 2100) {
        return { isValid: false, message: "Ano inválido. Use um valor entre 1900 e 2100" }
      }
    }

    return { isValid: true, message: "" }
  }

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const formatted = formatDateInput(e.target.value)
    setInputValue(formatted)

    // Validar a data em tempo real
    const validation = validateDate(formatted)

    if (!validation.isValid) {
      setIsInvalid(true)
      setErrorMessage(validation.message)
    } else {
      setIsInvalid(false)
      setErrorMessage("")

      // Tentar parsear a data se estiver completa e válida
      if (formatted.length === 10) {
        const parsedDate = parse(formatted, "dd/MM/yyyy", new Date())

        if (isValid(parsedDate)) {
          parsedDate.setHours(0, 0, 0, 0)
          setSelectedDate(parsedDate)
          setDate(parsedDate)
        }
      } else if (formatted.length === 0) {
        // Se apagou tudo, limpar a data
        setSelectedDate(undefined)
        setDate(undefined)
      }
    }
  }

  const handleInputBlur = () => {
    // Validar quando o usuário sai do campo
    const validation = validateDate(inputValue)

    if (!validation.isValid && inputValue.length > 0) {
      // Manter o erro visível
      setIsInvalid(true)
      setErrorMessage(validation.message)
    }
  }

  return (
    <TooltipProvider>
      <div className={cn("flex gap-1 items-center", className)}>
        <div className="flex-1 relative">
          <Tooltip open={isInvalid && errorMessage.length > 0}>
            <TooltipTrigger asChild>
              <Input
                type="text"
                placeholder={placeholder}
                value={inputValue}
                onChange={handleInputChange}
                onBlur={handleInputBlur}
                className={cn(
                  "w-full",
                  isInvalid && "border-red-500 focus-visible:ring-red-500 pr-9"
                )}
                maxLength={10}
              />
            </TooltipTrigger>
            <TooltipContent
              side="top"
              className="bg-red-600 text-white border-red-700"
            >
              <div className="flex items-center gap-2">
                <AlertCircle className="h-4 w-4" />
                <span>{errorMessage}</span>
              </div>
            </TooltipContent>
          </Tooltip>

          {isInvalid && (
            <div className="absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none">
              <AlertCircle className="h-4 w-4 text-red-500" />
            </div>
          )}
        </div>

        <Popover open={isOpen} onOpenChange={setIsOpen}>
          <PopoverTrigger asChild>
            <Button
              variant="outline"
              size="icon"
              className={cn(
                "h-9 w-9",
                !selectedDate && "text-muted-foreground"
              )}
            >
              <CalendarIcon className="h-4 w-4" />
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-0" align="start">
            <Calendar
              mode="single"
              selected={selectedDate}
              onSelect={handleDateSelect}
              initialFocus
              locale={ptBR}
            />
          </PopoverContent>
        </Popover>
      </div>
    </TooltipProvider>
  )
}
