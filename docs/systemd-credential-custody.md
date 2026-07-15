# Offline systemd credential custody checklist

Status: operator checklist only. It does not provision a production key, modify a
service, or authorize deployment.

K-SNS uses a 32-byte regional envelope key only through systemd's
`LoadCredentialEncrypted=` boundary. The encrypted-at-rest blob belongs in
`/etc/credstore.encrypted/`; the Node process reads only the 32-byte plaintext
file that systemd exposes inside `$CREDENTIALS_DIRECTORY` for the service
lifetime. The key must never appear in an environment variable, repository,
container image, database, command-line argument, log, browser, or support
artifact.

## Preconditions

1. Work on the intended regional host from an offline root console.
2. Confirm `systemd-creds has-tpm2` reports no TPM and record that this profile
   depends on the host systemd credential secret. Do not imply TPM protection.
3. Confirm the unit name, region, expected key identifier
   (`ksns-auth-ng-transaction-kek` or `ksns-auth-ca-transaction-kek`), new
   monotonically increasing version, and rollback window.
4. Set `umask 077`. Ensure `/etc/credstore.encrypted` is root-owned and not
   group/world accessible.

## Generate and encrypt without a plaintext file

After a separately authorized maintenance change, generate 32 random bytes and
pipe them directly into `systemd-creds encrypt` using the fixed credential
name. Do not substitute shell variables or command-line key text:

```sh
umask 077
openssl rand 32 |
  systemd-creds encrypt --name=ksns-transaction-kek-current -     /etc/credstore.encrypted/ksns-transaction-kek-current
chown root:root /etc/credstore.encrypted/ksns-transaction-kek-current
chmod 600 /etc/credstore.encrypted/ksns-transaction-kek-current
```

The command is an offline procedure, not an instruction to run during source
validation. Verify only encrypted metadata with `systemd-creds cat`; never
decrypt to a persistent file.

## Install and validate

1. Install the reviewed drop-in as root-owned 0644.
2. Put only key identifier/version metadata in the protected server
   configuration. Do not put the key or encoded key there.
3. Run `systemd-analyze verify`, then `systemctl daemon-reload`.
4. Start through systemd. The encrypted-at-rest blob remains root-owned 0600.
   The decrypted runtime credential must be exposed by systemd as a non-root,
   service-UID-owned 0400 file inside a service-UID-owned directory with no
   group/world access. A missing directory, UID mismatch, symlink, wrong mode,
   or key length other than 32 bytes must keep K-SNS unavailable.
5. Verify the running process receives `CREDENTIALS_DIRECTORY` from systemd,
   and that the credential is not present in `docker inspect`, image history,
   `systemctl show ... Environment`, logs, or browser artifacts.

## Rotation and rollback

1. Move the prior encrypted current blob to the fixed previous credential name;
   never decrypt it.
2. Generate a new encrypted current blob and increment the protected current
   version. Set the previous version to the immediately preceding version.
3. Enable the previous `LoadCredentialEncrypted=` line and restart. New
   envelopes use current; existing envelopes may decrypt with current or
   previous.
4. After all 24-hour transaction tombstones and encrypted live records using the
   previous version have expired, remove the previous version metadata, drop-in
   line, and encrypted blob. A retired/unknown version fails closed.
5. Rollback may restore the prior application image only while that image
   understands the configured current/previous versions. Never restore an
   encrypted blob under a different version or key identifier.

Keep an offline recovery copy of the encrypted blob, its non-secret
identifier/version manifest, and the separately protected host systemd
credential secret needed to decrypt it. Store those in distinct controlled
offline custody. Never place the host secret or decrypted KEK in this repository
or application backup. Recovery is a separately authorized ceremony and must
prove region, key identifier, version, ownership, and audit provenance before
service restart.
