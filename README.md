
greymass-revoter
================

Service that refreshes all producer votes for all accounts that it can sign for.

Developing
----------

With node.js installed, run `make dev`. See `config/default.toml` for configuration options. `EOSIO_KEY` required to run.

Run with docker
---------------

```
$ docker build .
...
<container id>
$ docker run -d --name greymass-revoter \
    -e EOSIO_KEY="5voterkeyvoterkey" \
    -e EOSIO_PERM="vote" \
    <container id>
```
