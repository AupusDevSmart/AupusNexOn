import { useState } from "react";
import { MessageCircleWarning } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  SidebarMenuButton,
} from "@/components/ui/sidebar";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";

// Define the form schema using zod
const feedbackSchema = z.object({
  tipo: z.enum(["bug", "sugestão"]),
  descricao: z.string().min(1, "Descrição é obrigatória"),
});

type FeedbackFormValues = z.infer<typeof feedbackSchema>;

export function FeedbackButton() {
  const [isOpen, setIsOpen] = useState(false);

  // Initialize the form with react-hook-form and zod
  const form = useForm<FeedbackFormValues>({
    resolver: zodResolver(feedbackSchema),
    defaultValues: {
      tipo: "sugestão",
      descricao: "",
    },
  });

  // Define the mutation for submitting feedback
  // const submitFeedbackMutation = useMutation({
  //   mutationFn: (data: FeedbackFormValues) => api.post("SPA/feedback", data),
  //   onSuccess: () => {
  //     toast({
  //       description: "Feedback enviado com sucesso!",
  //       duration: 3000,
  //     });
  //     setIsOpen(false);
  //     form.reset();
  //   },
  //   onError: (error) => {
  //     toast({
  //       variant: "destructive",
  //       //@ts-ignore
  //       description: error.response?.data?.mensagem || "Erro ao enviar feedback",
  //       duration: 3000,
  //     });
  //   },
  // });

  // Handle form submission
  // const handleSubmit = (data: FeedbackFormValues) => {
  //   submitFeedbackMutation.mutate(data);
  // };

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        <SidebarMenuButton
          tooltip="Chame a Aupus!"
          onClick={() => setIsOpen(true)}
          // Verde é a cor de ação da marca; texto sobre verde é sempre o azul NexON.
          className="h-10 rounded-lg bg-nexon-verde font-medium text-nexon-azul hover:bg-nexon-verde/90 hover:text-nexon-azul group-data-[collapsible=icon]:rounded-xl"
        >
          <MessageCircleWarning className="!size-5 shrink-0 group-data-[collapsible=icon]:!size-[22px]" />
          {/* No trilho recolhido fica só o ícone, como nos demais itens. */}
          <span className="flex group-data-[collapsible=icon]:hidden">Chame a Aupus!</span>
        </SidebarMenuButton>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Chame a Aupus!</DialogTitle>
          <DialogDescription>
            Relate uma falha, elogio, sugestão ou chame a Aupus.
          </DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form className="space-y-4">
            <FormField
              control={form.control}
              name="tipo"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Tipo</FormLabel>
                  <Select onValueChange={field.onChange} defaultValue={field.value}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Selecione o tipo" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="sugestão">Sugestão</SelectItem>
                      <SelectItem value="bug">Falha</SelectItem>
                      <SelectItem value="elogio">Elogio</SelectItem>
                      <SelectItem value="servico">Serviço</SelectItem>
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="descricao"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Descrição</FormLabel>
                  <FormControl>
                    <Textarea
                      placeholder="Descreva o que você gostaria de relatar..."
                      className="resize-none"
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <div className="flex justify-end gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => setIsOpen(false)}
              >
                Cancelar
              </Button>
              <Button
                type="submit"
                className="bg-card-foreground  text-card"
              >
                {"Enviar"}
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}