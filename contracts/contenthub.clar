;; ContentHub Contract
;; Clarity v2
;; Manages article submission, retrieval, and metadata for TruthHub journalism platform
;; Integrates with IPFS for decentralized storage, includes admin controls and event logging

(define-constant ERR-NOT-AUTHORIZED u100)
(define-constant ERR-INVALID-IPFS-HASH u101)
(define-constant ERR-ARTICLE-NOT-FOUND u102)
(define-constant ERR-ALREADY-PUBLISHED u103)
(define-constant ERR-NOT-PUBLISHED u104)
(define-constant ERR-INVALID-CATEGORY u105)
(define-constant ERR-ZERO-ADDRESS u106)
(define-constant ERR-PAUSED u107)
(define-constant ERR-INVALID-TIMESTAMP u108)

;; Article categories (e.g., news, opinion, investigative)
(define-constant CATEGORIES (list "news" "opinion" "investigative" "feature" "analysis"))

;; Contract state
(define-data-var admin principal tx-sender)
(define-data-var paused bool false)
(define-data-var article-counter uint u0)
(define-data-var max-title-length uint u100)
(define-data-var max-tags uint u5)

;; Article data structure
(define-map articles uint
  {
    author: principal,
    ipfs-hash: (string-ascii 46), ;; IPFS hash length (CIDv0)
    title: (string-ascii 100),
    category: (string-ascii 20),
    tags: (list 5 (string-ascii 20)),
    timestamp: uint,
    published: bool,
    funding-vault-id: uint
  }
)

;; Event logs for transparency
(define-map article-events uint (list 100 { event-type: (string-ascii 20), timestamp: uint, actor: principal }))

;; Private helper: validate IPFS hash (basic CIDv0 check)
(define-private (is-valid-ipfs-hash (hash (string-ascii 46)))
  (and
    (is-eq (len hash) u46)
    (is-eq (slice? hash u0 u2) (some "Qm"))
  )
)

;; Private helper: validate category
(define-private (is-valid-category (category (string-ascii 20)))
  (is-some (index-of CATEGORIES category))
)

;; Private helper: ensure not paused
(define-private (ensure-not-paused)
  (asserts! (not (var-get paused)) (err ERR-PAUSED))
)

;; Private helper: is-admin
(define-private (is-admin)
  (is-eq tx-sender (var-get admin))
)

;; Transfer admin rights
(define-public (transfer-admin (new-admin principal))
  (begin
    (asserts! (is-admin) (err ERR-NOT-AUTHORIZED))
    (asserts! (not (is-eq new-admin 'SP000000000000000000002Q6VF78)) (err ERR-ZERO-ADDRESS))
    (var-set admin new-admin)
    (ok true)
  )
)

;; Pause/unpause the contract
(define-public (set-paused (pause bool))
  (begin
    (asserts! (is-admin) (err ERR-NOT-AUTHORIZED))
    (var-set paused pause)
    (ok pause)
  )
)

;; Update max title length
(define-public (set-max-title-length (new-length uint))
  (begin
    (asserts! (is-admin) (err ERR-NOT-AUTHORIZED))
    (asserts! (> new-length u0) (err ERR-INVALID-TIMESTAMP))
    (var-set max-title-length new-length)
    (ok true)
  )
)

;; Publish an article
(define-public (publish-article
  (ipfs-hash (string-ascii 46))
  (title (string-ascii 100))
  (category (string-ascii 20))
  (tags (list 5 (string-ascii 20))))
  (begin
    (ensure-not-paused)
    (asserts! (is-valid-ipfs-hash ipfs-hash) (err ERR-INVALID-IPFS-HASH))
    (asserts! (<= (len title) (var-get max-title-length)) (err ERR-INVALID-TIMESTAMP))
    (asserts! (is-valid-category category) (err ERR-INVALID-CATEGORY))
    (asserts! (<= (len tags) (var-get max-tags)) (err ERR-INVALID-TIMESTAMP))
    (asserts! (> block-height u0) (err ERR-INVALID-TIMESTAMP))
    (let
      (
        (article-id (+ (var-get article-counter) u1))
      )
      (map-set articles article-id
        {
          author: tx-sender,
          ipfs-hash: ipfs-hash,
          title: title,
          category: category,
          tags: tags,
          timestamp: block-height,
          published: true,
          funding-vault-id: article-id
        }
      )
      (map-set article-events article-id
        (cons { event-type: "published", timestamp: block-height, actor: tx-sender }
              (default-to (list) (map-get? article-events article-id)))
      )
      (var-set article-counter article-id)
      (ok article-id)
    )
  )
)

;; Update article metadata (pre-publication)
(define-public (update-article-metadata
  (article-id uint)
  (ipfs-hash (string-ascii 46))
  (title (string-ascii 100))
  (category (string-ascii 20))
  (tags (list 5 (string-ascii 20))))
  (begin
    (ensure-not-paused)
    (let ((article (unwrap! (map-get? articles article-id) (err ERR-ARTICLE-NOT-FOUND))))
      (asserts! (is-eq (get author article) tx-sender) (err ERR-NOT-AUTHORIZED))
      (asserts! (not (get published article)) (err ERR-ALREADY-PUBLISHED))
      (asserts! (is-valid-ipfs-hash ipfs-hash) (err ERR-INVALID-IPFS-HASH))
      (asserts! (<= (len title) (var-get max-title-length)) (err ERR-INVALID-TIMESTAMP))
      (asserts! (is-valid-category category) (err ERR-INVALID-CATEGORY))
      (map-set articles article-id
        {
          author: (get author article),
          ipfs-hash: ipfs-hash,
          title: title,
          category: category,
          tags: tags,
          timestamp: block-height,
          published: false,
          funding-vault-id: (get funding-vault-id article)
        }
      )
      (map-set article-events article-id
        (cons { event-type: "metadata-updated", timestamp: block-height, actor: tx-sender }
              (default-to (list) (map-get? article-events article-id)))
      )
      (ok true)
    )
  )
)

;; Set article as published
(define-public (set-article-published (article-id uint))
  (begin
    (ensure-not-paused)
    (let ((article (unwrap! (map-get? articles article-id) (err ERR-ARTICLE-NOT-FOUND))))
      (asserts! (is-eq (get author article) tx-sender) (err ERR-NOT-AUTHORIZED))
      (asserts! (not (get published article)) (err ERR-ALREADY-PUBLISHED))
      (map-set articles article-id
        (merge article { published: true, timestamp: block-height })
      )
      (map-set article-events article-id
        (cons { event-type: "published", timestamp: block-height, actor: tx-sender }
              (default-to (list) (map-get? article-events article-id)))
      )
      (ok true)
    )
  )
)

;; Read-only: get article details
(define-read-only (get-article (article-id uint))
  (let ((article (unwrap! (map-get? articles article-id) (err ERR-ARTICLE-NOT-FOUND))))
    (asserts! (get published article) (err ERR-NOT-PUBLISHED))
    (ok article)
  )
)

;; Read-only: get article events
(define-read-only (get-article-events (article-id uint))
  (ok (default-to (list) (map-get? article-events article-id)))
)

;; Read-only: get article counter
(define-read-only (get-article-counter)
  (ok (var-get article-counter))
)

;; Read-only: get admin
(define-read-only (get-admin)
  (ok (var-get admin))
)

;; Read-only: check if paused
(define-read-only (is-paused)
  (ok (var-get paused))
)

;; Read-only: get max title length
(define-read-only (get-max-title-length)
  (ok (var-get max-title-length))
)