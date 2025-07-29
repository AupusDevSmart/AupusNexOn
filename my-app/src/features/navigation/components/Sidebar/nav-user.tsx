import { 
  LogOut, 
  Sun, 
  Moon, 
  Laptop2,
  UserCog
} from "lucide-react"
import {
  Avatar,
  AvatarFallback,
} from "@/components/ui/avatar"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger
} from "@/components/ui/dropdown-menu"
import {
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from "@/components/ui/sidebar"
import { useUserStore } from "@/store/useUserStore"
import { getInitials } from "@/lib/getInitials"
import {  useTheme } from "@/components/theme-provider"
import { useNavigate } from "react-router-dom"
import clsx from "clsx" // Para manipulação condicional de classes

export function NavUser() {
  const { isMobile } = useSidebar()
  const { user, clearUser } = useUserStore()
  const { theme, setTheme } = useTheme()
  const navigate = useNavigate()

  const logout = () => {
    clearUser();
    navigate('/login');
  }

  const editProfile = () => {
    navigate('/configuracoes/perfil');
  }

  return (
    <SidebarMenu>
      <SidebarMenuItem>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <SidebarMenuButton
              size="lg"
              className="data-[state=open]:bg-sidebar-accent data-[state=open]:text-sidebar-accent-foreground"
            >
              <Avatar className="h-8 w-8 rounded-lg">
                <AvatarFallback className="rounded-lg">{getInitials('Nicolas Santana')}</AvatarFallback>
              </Avatar>
              <div className="grid flex-1 text-left text-sm leading-tight">
                <span className="truncate font-semibold">{"Nicolas Santana"}</span>
                <span className="truncate text-xs">{'nicolassantanakruger@gmail.com'}</span>
              </div>
            </SidebarMenuButton>
          </DropdownMenuTrigger>
          <DropdownMenuContent
            className="w-[--radix-dropdown-menu-trigger-width] min-w-56 rounded-lg shadow-lg"
            side={isMobile ? "bottom" : "right"}
            align="end"
            sideOffset={4}
          >
            <DropdownMenuLabel className="p-0 font-normal">
              <div className="flex items-center gap-2 px-1 py-1.5 text-left text-sm">
                <Avatar className="h-8 w-8 rounded-lg">
                  <AvatarFallback className="rounded-lg">{getInitials("Nicolas Santana")}</AvatarFallback>
                </Avatar>
                <div className="grid flex-1 text-left text-sm leading-tight">
                  <span className="truncate font-semibold">{"Nicolas Santana"}</span>
                  <span className="truncate text-xs">{'nicolassantanakruger@gmail.com'}</span>
                </div>
              </div>
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            
            {/* Botão de Editar Perfil */}
            <DropdownMenuItem onClick={editProfile} className="cursor-pointer">
              <UserCog className="mr-2 h-4 w-4" />
              Editar Perfil
            </DropdownMenuItem>
            
            <DropdownMenuSeparator />
            
            {/* Seção de Preferências */}
            <DropdownMenuLabel className="text-xs text-gray-500 px-2">Preferências</DropdownMenuLabel>
            <div className="flex flex-col px-2 gap-2">
              <div className="flex items-center gap-2">
                <span className="text-sm">Tema</span>
                <div className="flex items-center gap-1 ml-auto">
                  <button 
                    onClick={() => setTheme("system")}
                    className={clsx("p-2 rounded-md flex items-center border", {
                      "bg-gray-700 text-white border-transparent": theme === "system",
                      "text-gray-400 border-gray-600": theme !== "system"
                    })}
                  >
                    <Laptop2 className="h-4 w-4" />
                  </button>
                  <button 
                    onClick={() => setTheme("light")}
                    className={clsx("p-2 rounded-md flex items-center border", {
                      "bg-gray-700 text-white border-transparent": theme === "light",
                      "text-gray-400 border-gray-600": theme !== "light"
                    })}
                  >
                    <Sun className="h-4 w-4" />
                  </button>
                  <button 
                    onClick={() => setTheme("dark")}
                    className={clsx("p-2 rounded-md flex items-center border", {
                      "bg-gray-700 text-white border-transparent": theme === "dark",
                      "text-gray-400 border-gray-600": theme !== "dark"
                    })}
                  >
                    <Moon className="h-4 w-4" />
                  </button>
                </div>
              </div>
            </div>

            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={logout}>
              <LogOut className="mr-2 h-4 w-4" />
              Sair
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </SidebarMenuItem>
    </SidebarMenu>
  )
}