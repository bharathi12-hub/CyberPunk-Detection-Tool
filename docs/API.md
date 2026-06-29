# REST API

## Base URL

```
http://localhost:3000
```

---

## POST

/api/scan

Request

```json
{
"url":"https://example.com"
}
```

Response

```json
{
"score":82,
"risk":"LOW",
"summary":"Safe website."
}
```

---

## GET

/api/history

Returns scan history.

---

## GET

/api/report/:id

Returns report.

---

## DELETE

/api/history

Deletes history.

---

## POST

/api/export/pdf

Exports report.

---

## POST

/api/export/docx

Exports report.

---

## POST

/api/export/txt

Exports report.
