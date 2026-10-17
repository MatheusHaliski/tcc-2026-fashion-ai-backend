import socket
from unittest.mock import patch
from services.anatomical_vton.deploy.railway.serve import listening_socket


class FakeSocket:
    made=[]
    def __init__(self,family,kind,fail_bind=False):
        self.family=family;self.options=[];self.bound=None;self.closed=False;self.fail_bind=fail_bind;FakeSocket.made.append(self)
    def setsockopt(self,level,name,value):self.options.append((level,name,value))
    def bind(self,address):
        if self.fail_bind:raise OSError('no IPv6 on this host')
        self.bound=address
    def listen(self,backlog):self.backlog=backlog
    def close(self):self.closed=True


def test_dual_stack_socket_turns_v6only_off_so_ipv4_healthcheck_and_ipv6_private_network_both_connect():
    FakeSocket.made=[]
    with patch('socket.socket',lambda family,kind:FakeSocket(family,kind)):
        sock,host=listening_socket(8080)
    assert host=='::' and sock.family==socket.AF_INET6 and sock.bound==('::',8080)
    assert (socket.IPPROTO_IPV6,socket.IPV6_V6ONLY,0) in sock.options


def test_host_without_ipv6_falls_back_to_ipv4():
    FakeSocket.made=[]
    with patch('socket.socket',lambda family,kind:FakeSocket(family,kind,fail_bind=family==socket.AF_INET6)):
        sock,host=listening_socket(8080)
    assert host=='0.0.0.0' and sock.family==socket.AF_INET and sock.bound==('0.0.0.0',8080)
    assert FakeSocket.made[0].closed  # the failed IPv6 socket is not leaked
