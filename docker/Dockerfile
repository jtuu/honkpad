FROM ubuntu

RUN apt-get update
RUN apt-get install -y ca-certificates

RUN useradd honkpad-docker -u 1001 -d /nonexistent -s /bin/false
USER honkpad-docker
