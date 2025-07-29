//@ts-nocheck
import { useRef, useCallback } from "react";
import { useInfiniteQuery, useMutation, useQueryClient } from "react-query";
import { ArrowDownToLine, Bell, CheckCheck, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetClose,
  SheetContent,
  SheetTrigger,
} from "@/components/ui/sheet";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Card,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { api } from "@/config/api";

type Notificacao = {
  id: string;
  titulo: string;
  descricao: string;
  tipo?: string;
  lida: boolean;
  link?: string;
  data: string;
};

// const fetchNotifications = async ({ pageParam = 1, queryKey }) => {
//   const [, lida] = queryKey;
//   const res = await api.get(`SPA/notificacoes?lida=${lida}&page=${pageParam}`);
//   return res.data;
// };

// function formatNotificationDate(dateStr: string): string {
//   // Parse "DD/MM/YYYY HH:mm" para Date
//   function parseDatePTBR(str: string): Date {
//     const [datePart, timePart] = str.split(" ");
//     const [day, month, year] = datePart.split("/").map(Number);
//     const [hour, minute] = timePart.split(":").map(Number);
//     return new Date(year, month - 1, day, hour, minute);
//   }

//   const notificationDate = parseDatePTBR(dateStr);
//   const now = new Date();
//   let diffMs = now.getTime() - notificationDate.getTime();
//   if (diffMs < 0) diffMs = 0;

//   const diffHours = diffMs / 36e5;
//   if (diffHours < 1) {
//     const diffMinutes = Math.floor(diffMs / 6e4);
//     return `há ${diffMinutes} min`;
//   }
//   if (diffHours < 5) {
//     const hours = Math.floor(diffHours);
//     const minutes = Math.floor((diffHours - hours) * 60);
//     return minutes > 0 ? `há ${hours}h ${minutes}min` : `há ${hours}h`;
//   }
//   return dateStr;
// }

export function NotificacoesSheet() {
//   const queryClient = useQueryClient();

//   const {
//     data: unreadData,
//     fetchNextPage: fetchNextPageUnread,
//     hasNextPage: hasNextPageUnread,
//     isLoading: isLoadingUnread,
//   } = useInfiniteQuery(["notificacoes", 0], fetchNotifications, {
//     getNextPageParam: (lastPage) =>
//       lastPage.next_page_url ? lastPage.current_page + 1 : undefined,
//   });

//   const {
//     data: readData,
//     fetchNextPage: fetchNextPageRead,
//     hasNextPage: hasNextPageRead,
//     isLoading: isLoadingRead,
//   } = useInfiniteQuery(["notificacoes", 1], fetchNotifications, {
//     getNextPageParam: (lastPage) =>
//       lastPage.next_page_url ? lastPage.current_page + 1 : undefined,
//   });

//   const unreadNotificacoes: Notificacao[] =
//     unreadData?.pages.flatMap((page) => page.data) || [];
//   const readNotificacoes: Notificacao[] =
//     readData?.pages.flatMap((page) => page.data) || [];

//   // Containers de scroll
//   const unreadContainerRef = useRef<HTMLDivElement>(null);
//   const readContainerRef = useRef<HTMLDivElement>(null);

//   // Callback ref para o último elemento - Não lidas
//   const lastUnreadElementRef = useCallback(
//     (node: HTMLDivElement | null) => {
//       if (!node) return;
//       const observer = new IntersectionObserver(
//         (entries) => {
//           if (entries[0].isIntersecting && hasNextPageUnread) {
//             fetchNextPageUnread();
//           }
//         },
//         {
//           root: unreadContainerRef.current,
//           rootMargin: "100px",
//           threshold: 0,
//         }
//       );
//       observer.observe(node);
//     },
//     [hasNextPageUnread, fetchNextPageUnread]
//   );

//   // Callback ref para o último elemento - Lidas
//   const lastReadElementRef = useCallback(
//     (node: HTMLDivElement | null) => {
//       if (!node) return;
//       const observer = new IntersectionObserver(
//         (entries) => {
//           if (entries[0].isIntersecting && hasNextPageRead) {
//             fetchNextPageRead();
//           }
//         },
//         {
//           root: readContainerRef.current,
//           rootMargin: "100px",
//           threshold: 0,
//         }
//       );
//       observer.observe(node);
//     },
//     [hasNextPageRead, fetchNextPageRead]
//   );

//   const { mutate: marcarNotificacaoComoLida } = useMutation(
//     async (notificacaoId: string) => {
//       const res = await api.post(
//         `SPA/notificacoes/${notificacaoId}/marcarComoLida`
//       );
//       return res.data;
//     },
//     {
//       onSuccess: (_, notificacaoId) => {
//         queryClient.setQueryData(["notificacoes", 0], (oldData) => {
//           if (!oldData) return oldData;
//           return {
//             ...oldData,
//             pages: oldData.pages.map((page) => ({
//               ...page,
//               data: page.data.filter(
//                 (n: Notificacao) => n.id !== notificacaoId
//               ),
//             })),
//           };
//         });
//         queryClient.invalidateQueries(["notificacoes", 1]);
//       },
//     }
//   );

//   const { mutate: marcarTodasComoLidas } = useMutation(
//     async () => {
//       const res = await api.post(`SPA/notificacoes/marcarTodasComoLidas`);
//       return res.data;
//     },
//     {
//       onSuccess: () => {
//         queryClient.setQueryData(["notificacoes", 0], (oldData) => {
//           if (!oldData) return oldData;
//           return {
//             ...oldData,
//             pages: oldData.pages.map((page) => ({ ...page, data: [] })),
//           };
//         });
//         queryClient.invalidateQueries(["notificacoes", 1]);
//       },
//     }
//   );

  return (
    <Sheet>
      {/* <SheetTrigger asChild className="m-3">
        <Button variant="outline" className="relative bg-card" size="icon">
          <Bell className="w-4 h-4" />
          {unreadNotificacoes.length > 0 && (
            <Badge className="absolute -top-2 -right-2 px-2 py-0.5 text-xs bg-red-500 text-white">
              {unreadData?.pages[0]?.stats?.nao_lidas}
            </Badge>
          )}
        </Button>
      </SheetTrigger> */}

      <SheetContent side="right" className="p-0 w-full max-w-md">
        <div className="flex items-center justify-between p-2 border-b">
          <h2 className="text-lg font-semibold ml-4">Notificações</h2>
          <SheetClose asChild>
            <Button variant="ghost" size="icon" className="h-8 w-8 rounded-full">
              <X className="h-4 w-4" />
            </Button>
          </SheetClose>
        </div>

        <Tabs defaultValue="nao-lidas" className="p-4">
          <TabsList className="grid grid-cols-2 bg-card rounded-sm">
            <TabsTrigger value="nao-lidas">Não lidas</TabsTrigger>
            <TabsTrigger value="lidas">Lidas</TabsTrigger>
          </TabsList>

          {/* <TabsContent value="nao-lidas">
            <div
              ref={unreadContainerRef}
              className="overflow-y-auto max-h-[75vh]"
            >
              {unreadNotificacoes.length ? (
                <>
                  {unreadNotificacoes.map((notificacao, index) => {
                    const content = (
                      <Card className="mb-2 bg-card">
                        <CardHeader className="flex gap-2">
                          <div className="flex flex-row justify-between items-center">
                            <CardTitle className="text-lg">
                              {notificacao.titulo}
                            </CardTitle>
                            <span className="text-sm text-muted-foreground">
                              {formatNotificationDate(notificacao.data)}
                            </span>
                          </div>
                          <CardDescription>
                            {notificacao.descricao}
                          </CardDescription>
                        </CardHeader>
                        <CardFooter className="flex justify-end space-x-2">
                          {notificacao.tipo === "boleto" && (
                            <Button
                              rel="noopener noreferrer"
                              variant="outline"
                              size="sm"
                              className="rounded-sm bg-card flex gap-2"
                            >
                              <ArrowDownToLine className="w-4 h-4" />
                              Baixar boleto
                            </Button>
                          )}
                          <Button
                            variant="outline"
                            size="sm"
                            className="bg-card rounded-sm"
                            onClick={() =>
                              marcarNotificacaoComoLida(notificacao.id)
                            }
                          >
                            <CheckCheck className="mr-2 h-4 w-4" />
                            Marcar como lida
                          </Button>
                        </CardFooter>
                      </Card>
                    );
                    return index === unreadNotificacoes.length - 1 ? (
                      <div key={notificacao.id} ref={lastUnreadElementRef}>
                        {content}
                      </div>
                    ) : (
                      <div key={notificacao.id}>{content}</div>
                    );
                  })}
                  {isLoadingUnread && <p>Carregando...</p>}
                </>
              ) : (
                <p className="text-center py-4">
                  Sem notificações novas.
                </p>
              )}
            </div>
            {unreadNotificacoes.length > 0 && (
              <Button
                variant="secondary"
                onClick={() => marcarTodasComoLidas()}
                className="mt-2 w-full rounded-sm"
              >
                <CheckCheck className="mr-2 h-4 w-4" /> Marcar todas como lidas
              </Button>
            )}
          </TabsContent> */}

          {/* <TabsContent value="lidas">
            <div ref={readContainerRef} className="overflow-y-auto max-h-[75vh]">
              {readNotificacoes.length ? (
                <>
                  {readNotificacoes.map((notificacao, index) => {
                    const content = (
                      <Card className="mb-2 bg-card">
                        <CardHeader className="flex gap-2">
                          <div className="flex flex-row justify-between items-center">
                            <CardTitle className="text-lg">
                              {notificacao.titulo}
                            </CardTitle>
                            <span className="text-sm text-muted-foreground">
                              {formatNotificationDate(notificacao.data)}
                            </span>
                          </div>
                          <CardDescription>
                            {notificacao.descricao}
                          </CardDescription>
                        </CardHeader>
                        {notificacao.tipo === "boleto" && (
                          <CardFooter className="flex justify-end">
                            <Button
                              rel="noopener noreferrer"
                              variant="outline"
                              size="sm"
                              className="rounded-sm bg-card flex gap-2"
                            >
                              <ArrowDownToLine className="w-4 h-4" />
                              Baixar boleto
                            </Button>
                          </CardFooter>
                        )}
                      </Card>
                    );
                    return index === readNotificacoes.length - 1 ? (
                      <div key={notificacao.id} ref={lastReadElementRef}>
                        {content}
                      </div>
                    ) : (
                      <div key={notificacao.id}>{content}</div>
                    );
                  })}
                  {isLoadingRead && <p>Carregando...</p>}
                </>
              ) : (
                <p className="text-center py-4">
                  Nenhuma notificação lida.
                </p>
              )}
            </div>
          </TabsContent> */}
        </Tabs>
      </SheetContent>
    </Sheet>
  );
}