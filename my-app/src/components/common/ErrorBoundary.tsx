import React, { Component, ReactNode } from 'react';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '../ui/tooltip';
import { TooltipArrow } from '@radix-ui/react-tooltip';
import { AlertCircle } from 'lucide-react';

interface ErrorBoundaryProps {
  children: ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
}


class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(): ErrorBoundaryState {
    return { hasError: true };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error('Error caught by Error Boundary: ', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <div className="flex items-center justify-center h-full">
                <AlertCircle className="w-8 h-8 text-destructive" />
              </div>
            </TooltipTrigger>
            <TooltipContent className="bg-foreground text-background p-2 rounded shadow-md">
              Algo deu errado.
              <TooltipArrow className="fill-foreground" />
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;