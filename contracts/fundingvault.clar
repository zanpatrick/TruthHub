;; FundingVault Contract
;; Clarity v2
;; Manages tokenized donations and subscriptions for TruthHub articles
;; Integrates with ContentHub for article validation, includes admin controls and event logging

(define-constant ERR-NOT-AUTHORIZED u100)
(define-constant ERR-ARTICLE-NOT-FOUND u101)
(define-constant ERR-INSUFFICIENT-AMOUNT u102)
(define-constant ERR-ZERO-ADDRESS u103)
(define-constant ERR-PAUSED u104)
(define-constant ERR-INVALID-ARTICLE u105)
(define-constant ERR-FUNDS-LOCKED u106)
(define-constant ERR-INVALID-TOKEN u107)

;; Contract state
(define-data-var admin principal tx-sender)
(define-data-var paused bool false)
(define-data-var token-address principal 'SP000000000000000000002Q6VF78) ;; Placeholder for TRUTH token
(define-data-var lock-period uint u1440) ;; Lock period in blocks (~10 days at 10 min/block)

;; Funding data structure
(define-map article-funds uint
  {
    total-amount: uint,
    released: bool,
    release-block: uint
  }
)

(define-map contributions
  { article-id: uint, donor: principal }
  { amount: uint }
)

;; Event logs for transparency
(define-map funding-events uint
  (list 100 { event-type: (string-ascii 20), timestamp: uint, actor: principal, amount: uint })
)

;; Private helper: is-admin
(define-private (is-admin)
  (is-eq tx-sender (var-get admin))
)

;; Private helper: ensure not paused
(define-private (ensure-not-paused)
  (asserts! (not (var-get paused)) (err ERR-PAUSED))
)

;; Private helper: validate article (assumes ContentHub contract exists)
(define-private (is-valid-article (article-id uint))
  (is-some (contract-call? .ContentHub get-article article-id))
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

;; Set token contract address
(define-public (set-token-address (new-token principal))
  (begin
    (asserts! (is-admin) (err ERR-NOT-AUTHORIZED))
    (asserts! (not (is-eq new-token 'SP000000000000000000002Q6VF78)) (err ERR-ZERO-ADDRESS))
    (var-set token-address new-token)
    (ok true)
  )
)

;; Set lock period
(define-public (set-lock-period (new-period uint))
  (begin
    (asserts! (is-admin) (err ERR-NOT-AUTHORIZED))
    (asserts! (> new-period u0) (err ERR-INSUFFICIENT-AMOUNT))
    (var-set lock-period new-period)
    (ok true)
  )
)

;; Donate to an article
(define-public (donate (article-id uint) (amount uint))
  (begin
    (ensure-not-paused)
    (asserts! (is-valid-article article-id) (err ERR-INVALID-ARTICLE))
    (asserts! (> amount u0) (err ERR-INSUFFICIENT-AMOUNT))
    (let
      (
        (current-funds (default-to { total-amount: u0, released: false, release-block: u0 } (map-get? article-funds article-id)))
      )
      (try! (contract-call? (var-get token-address) transfer amount tx-sender (as-contract tx-sender) none))
      (map-set article-funds article-id
        {
          total-amount: (+ (get total-amount current-funds) amount),
          released: false,
          release-block: (+ block-height (var-get lock-period))
        }
      )
      (map-set contributions { article-id: article-id, donor: tx-sender }
        { amount: (+ amount (default-to u0 (map-get? contributions { article-id: article-id, donor: tx-sender }))) }
      )
      (map-set funding-events article-id
        (cons
          { event-type: "donation", timestamp: block-height, actor: tx-sender, amount: amount }
          (default-to (list) (map-get? funding-events article-id))
        )
      )
      (ok true)
    )
  )
)

;; Release funds to article author
(define-public (release-funds (article-id uint))
  (begin
    (ensure-not-paused)
    (let
      (
        (article (unwrap! (contract-call? .ContentHub get-article article-id) (err ERR-ARTICLE-NOT-FOUND)))
        (funds (unwrap! (map-get? article-funds article-id) (err ERR-ARTICLE-NOT-FOUND)))
      )
      (asserts! (>= block-height (get release-block funds)) (err ERR-FUNDS-LOCKED))
      (asserts! (not (get released funds)) (err ERR-FUNDS-LOCKED))
      (asserts! (> (get total-amount funds) u0) (err ERR-INSUFFICIENT-AMOUNT))
      (try! (as-contract (contract-call? (var-get token-address) transfer (get total-amount funds) tx-sender (get author article) none)))
      (map-set article-funds article-id
        (merge funds { released: true })
      )
      (map-set funding-events article-id
        (cons
          { event-type: "released", timestamp: block-height, actor: (get author article), amount: (get total-amount funds) }
          (default-to (list) (map-get? funding-events article-id))
        )
      )
      (ok true)
    )
  )
)

;; Read-only: get article funds
(define-read-only (get-article-funds (article-id uint))
  (ok (default-to { total-amount: u0, released: false, release-block: u0 } (map-get? article-funds article-id)))
)

;; Read-only: get donor contribution
(define-read-only (get-contribution (article-id uint) (donor principal))
  (ok (default-to u0 (map-get? contributions { article-id: article-id, donor: donor })))
)

;; Read-only: get funding events
(define-read-only (get-funding-events (article-id uint))
  (ok (default-to (list) (map-get? funding-events article-id)))
)

;; Read-only: get admin
(define-read-only (get-admin)
  (ok (var-get admin))
)

;; Read-only: check if paused
(define-read-only (is-paused)
  (ok (var-get paused))
)

;; Read-only: get token address
(define-read-only (get-token-address)
  (ok (var-get token-address))
)

;; Read-only: get lock period
(define-read-only (get-lock-period)
  (ok (var-get lock-period))
)