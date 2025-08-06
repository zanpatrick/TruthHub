;; ReputationCore Contract
;; Clarity v2
;; Manages reputation scores for journalists and readers in TruthHub
;; Integrates with ContentHub for article validation, includes admin controls and event logging

(define-constant ERR-NOT-AUTHORIZED u100)
(define-constant ERR-INVALID-ARTICLE u101)
(define-constant ERR-ALREADY-FACT-CHECKED u102)
(define-constant ERR-ZERO-ADDRESS u103)
(define-constant ERR-PAUSED u104)
(define-constant ERR-INVALID-SCORE u105)
(define-constant ERR-INVALID-WEIGHT u106)
(define-constant MAX-SCORE u100)
(define-constant MIN-SCORE u0)

;; Contract state
(define-data-var admin principal tx-sender)
(define-data-var paused bool false)
(define-data-var fact-check-weight uint u10) ;; Weight of fact-checking contribution
(define-data-var feedback-weight uint u5) ;; Weight of feedback contribution

;; Reputation data structures
(define-map journalist-reputation principal { score: uint, article-count: uint })
(define-map reader-reputation principal { score: uint, fact-check-count: uint })
(define-map fact-checks { article-id: uint, checker: principal } { score: uint, timestamp: uint })
(define-map feedback { article-id: uint, reviewer: principal } { score: uint, timestamp: uint })

;; Event logs for transparency
(define-map reputation-events principal
  (list 100 { event-type: (string-ascii 20), timestamp: uint, actor: principal, article-id: uint, score: uint })
)

;; Private helper: is-admin
(define-private (is-admin)
  (is-eq tx-sender (var-get admin))
)

;; Private helper: ensure not paused
(define-private (ensure-not-paused)
  (asserts! (not (var-get paused)) (err ERR-PAUSED))
)

;; Private helper: validate article
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

;; Set fact-check weight
(define-public (set-fact-check-weight (new-weight uint))
  (begin
    (asserts! (is-admin) (err ERR-NOT-AUTHORIZED))
    (asserts! (> new-weight u0) (err ERR-INVALID-WEIGHT))
    (var-set fact-check-weight new-weight)
    (ok true)
  )
)

;; Set feedback weight
(define-public (set-feedback-weight (new-weight uint))
  (begin
    (asserts! (is-admin) (err ERR-NOT-AUTHORIZED))
    (asserts! (> new-weight u0) (err ERR-INVALID-WEIGHT))
    (var-set feedback-weight new-weight)
    (ok true)
  )
)

;; Submit fact-check for an article
(define-public (submit-fact-check (article-id uint) (score uint))
  (begin
    (ensure-not-paused)
    (asserts! (is-valid-article article-id) (err ERR-INVALID-ARTICLE))
    (asserts! (and (>= score MIN-SCORE) (<= score MAX-SCORE)) (err ERR-INVALID-SCORE))
    (asserts! (is-none (map-get? fact-checks { article-id: article-id, checker: tx-sender })) (err ERR-ALREADY-FACT-CHECKED))
    (let
      (
        (article (unwrap! (contract-call? .ContentHub get-article article-id) (err ERR-INVALID-ARTICLE)))
        (journalist (get author article))
        (current-rep (default-to { score: u0, article-count: u0 } (map-get? journalist-reputation journalist)))
        (reader-rep (default-to { score: u0, fact-check-count: u0 } (map-get? reader-reputation tx-sender)))
      )
      (map-set fact-checks { article-id: article-id, checker: tx-sender } { score: score, timestamp: block-height })
      (map-set journalist-reputation journalist
        {
          score: (+ (get score current-rep) score),
          article-count: (+ (get article-count current-rep) u1)
        }
      )
      (map-set reader-reputation tx-sender
        {
          score: (+ (get score reader-rep) (var-get fact-check-weight)),
          fact-check-count: (+ (get fact-check-count reader-rep) u1)
        }
      )
      (map-set reputation-events journalist
        (cons
          { event-type: "fact-check", timestamp: block-height, actor: tx-sender, article-id: article-id, score: score }
          (default-to (list) (map-get? reputation-events journalist))
        )
      )
      (ok true)
    )
  )
)

;; Submit feedback for an article
(define-public (submit-feedback (article-id uint) (score uint))
  (begin
    (ensure-not-paused)
    (asserts! (is-valid-article article-id) (err ERR-INVALID-ARTICLE))
    (asserts! (and (>= score MIN-SCORE) (<= score MAX-SCORE)) (err ERR-INVALID-SCORE))
    (let
      (
        (article (unwrap! (contract-call? .ContentHub get-article article-id) (err ERR-INVALID-ARTICLE)))
        (journalist (get author article))
        (current-rep (default-to { score: u0, article-count: u0 } (map-get? journalist-reputation journalist)))
      )
      (map-set feedback { article-id: article-id, reviewer: tx-sender } { score: score, timestamp: block-height })
      (map-set journalist-reputation journalist
        {
          score: (+ (get score current-rep) score),
          article-count: (+ (get article-count current-rep) u1)
        }
      )
      (map-set reputation-events journalist
        (cons
          { event-type: "feedback", timestamp: block-height, actor: tx-sender, article-id: article-id, score: score }
          (default-to (list) (map-get? reputation-events journalist))
        )
      )
      (ok true)
    )
  )
)

;; Read-only: get journalist reputation
(define-read-only (get-journalist-reputation (journalist principal))
  (ok (default-to { score: u0, article-count: u0 } (map-get? journalist-reputation journalist)))
)

;; Read-only: get reader reputation
(define-read-only (get-reader-reputation (reader principal))
  (ok (default-to { score: u0, fact-check-count: u0 } (map-get? reader-reputation reader)))
)

;; Read-only: get fact-check
(define-read-only (get-fact-check (article-id uint) (checker principal))
  (ok (map-get? fact-checks { article-id: article-id, checker: checker }))
)

;; Read-only: get feedback
(define-read-only (get-feedback (article-id uint) (reviewer principal))
  (ok (map-get? feedback { article-id: article-id, reviewer: reviewer }))
)

;; Read-only: get reputation events
(define-read-only (get-reputation-events (journalist principal))
  (ok (default-to (list) (map-get? reputation-events journalist)))
)

;; Read-only: get admin
(define-read-only (get-admin)
  (ok (var-get admin))
)

;; Read-only: check if paused
(define-read-only (is-paused)
  (ok (var-get paused))
)

;; Read-only: get fact-check weight
(define-read-only (get-fact-check-weight)
  (ok (var-get fact-check-weight))
)

;; Read-only: get feedback weight
(define-read-only (get-feedback-weight)
  (ok (var-get feedback-weight))
)