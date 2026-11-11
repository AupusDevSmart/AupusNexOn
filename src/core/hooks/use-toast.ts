/**
 * O mesmo toast do app (`@/hooks/use-toast`, o que o Toaster do App mostra).
 *
 * Esta cópia tinha um estado próprio, e o Toaster dela nunca foi montado: os
 * avisos de Plantas, Concessionárias, Proprietários, do sheet da unidade e dos
 * anexos de equipamento, unidade e concessionária, de sucesso ou de erro, nunca
 * apareciam. O 409 "esta instalação é compartilhada" sumia calado (10/11/2026; o
 * Service fechou o mesmo defeito no SN-43).
 */
export { toast, useToast } from '@/hooks/use-toast';
