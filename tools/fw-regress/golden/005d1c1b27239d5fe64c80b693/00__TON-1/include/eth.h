#ifndef ETH_H
#define ETH_H
#include <Arduino.h>
#include <Ethernet.h>
#include <IPAddress.h>

bool eth_hw_init();           // Inicializa W5500 (so a parte fisica/SPI). Sem DHCP.
bool eth_link_up();           // Cabo plugado e link UP?
bool eth_has_ip();            // Temos IP atribuido (DHCP ou estatico)?
bool eth_check_dhcp();        // Tenta DHCP se link UP e ainda sem IP. true = temos IP no fim.
EthernetClient& eth_get_client();
IPAddress       eth_local_ip();

// Compat antigos
bool eth_init();
bool eth_connected();
void eth_maintain();

#endif
