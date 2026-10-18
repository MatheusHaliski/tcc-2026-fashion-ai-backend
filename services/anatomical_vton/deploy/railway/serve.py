"""Sobe o worker num socket só, IPv4 e IPv6 ao mesmo tempo.

O healthcheck do Railway chega por IPv4 e a rede privada (vton-worker.railway.internal) por IPv6. O uvicorn com
--host :: herda o bindv6only do kernel e, no container do Railway, passou a aceitar só IPv6 (healthcheck "service
unavailable"). Aqui o socket desliga IPV6_V6ONLY explicitamente; sem IPv6 no host, cai para 0.0.0.0.
"""
import os
import socket
import uvicorn


def listening_socket(port):
    try:
        sock=socket.socket(socket.AF_INET6,socket.SOCK_STREAM)
        try:
            sock.setsockopt(socket.SOL_SOCKET,socket.SO_REUSEADDR,1)
            sock.setsockopt(socket.IPPROTO_IPV6,socket.IPV6_V6ONLY,0)
            sock.bind(('::',port))
        except OSError:
            sock.close();raise
        host='::'
    except OSError:
        sock=socket.socket(socket.AF_INET,socket.SOCK_STREAM)
        sock.setsockopt(socket.SOL_SOCKET,socket.SO_REUSEADDR,1)
        sock.bind(('0.0.0.0',port));host='0.0.0.0'
    sock.listen(2048)
    return sock,host


def main():
    port=int(os.getenv('PORT','8080'))
    sock,host=listening_socket(port)
    config=uvicorn.Config('services.anatomical_vton.api:app',host=host,port=port,workers=1,access_log=False)
    uvicorn.Server(config).run(sockets=[sock])


if __name__=='__main__':
    main()
