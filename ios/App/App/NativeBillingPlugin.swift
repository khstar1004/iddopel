import Capacitor
import StoreKit

@objc(NativeBillingPlugin)
public class NativeBillingPlugin: CAPPlugin, CAPBridgedPlugin {
    public let identifier = "NativeBillingPlugin"
    public let jsName = "NativeBilling"
    public let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "purchaseDetailedReport", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "restoreDetailedReport", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "completeDetailedReportPurchase", returnType: CAPPluginReturnPromise)
    ]

    private var pendingTransactions: [String: Transaction] = [:]

    @objc func purchaseDetailedReport(_ call: CAPPluginCall) {
        let productId = normalizedProductId(call.getString("appleProductId"))

        Task { @MainActor in
            do {
                let products = try await Product.products(for: [productId])
                guard let product = products.first else {
                    call.reject("App Store 정밀 리포트 상품을 찾지 못했어요.")
                    return
                }

                let result = try await product.purchase()
                switch result {
                case .success(let verification):
                    let transaction = try checkVerified(verification)
                    pendingTransactions[String(transaction.id)] = transaction
                    call.resolve(toAppStoreResult(transaction))
                case .userCancelled:
                    call.reject("결제가 취소됐어요.")
                case .pending:
                    call.reject("결제가 아직 대기 중이에요. 결제가 완료되면 구매 복원을 눌러 주세요.")
                @unknown default:
                    call.reject("App Store 결제 결과를 확인하지 못했어요.")
                }
            } catch {
                call.reject("App Store 결제를 완료하지 못했어요.", nil, error)
            }
        }
    }

    @objc func restoreDetailedReport(_ call: CAPPluginCall) {
        let productId = normalizedProductId(call.getString("appleProductId"))

        Task { @MainActor in
            do {
                for await verification in Transaction.unfinished {
                    let transaction = try checkVerified(verification)
                    if transaction.productID == productId {
                        pendingTransactions[String(transaction.id)] = transaction
                        call.resolve(toAppStoreResult(transaction))
                        return
                    }
                }
                call.reject("복원할 정밀 리포트 구매를 찾지 못했어요.")
            } catch {
                call.reject("구매 복원을 완료하지 못했어요.", nil, error)
            }
        }
    }

    @objc func completeDetailedReportPurchase(_ call: CAPPluginCall) {
        guard let transactionId = call.getString("transactionId"), !transactionId.isEmpty else {
            call.resolve(["ok": true])
            return
        }

        Task { @MainActor in
            do {
                if let transaction = pendingTransactions.removeValue(forKey: transactionId) {
                    await transaction.finish()
                    call.resolve(["ok": true, "transactionId": transactionId])
                    return
                }

                for await verification in Transaction.unfinished {
                    let transaction = try checkVerified(verification)
                    if String(transaction.id) == transactionId {
                        await transaction.finish()
                        call.resolve(["ok": true, "transactionId": transactionId])
                        return
                    }
                }

                call.resolve(["ok": true, "transactionId": transactionId])
            } catch {
                call.reject("App Store 구매 완료 처리를 하지 못했어요.", nil, error)
            }
        }
    }

    private func normalizedProductId(_ value: String?) -> String {
        let productId = value?.trimmingCharacters(in: .whitespacesAndNewlines) ?? ""
        return productId.isEmpty ? "detailed_report" : productId
    }

    private func checkVerified<T>(_ result: VerificationResult<T>) throws -> T {
        switch result {
        case .verified(let safe):
            return safe
        case .unverified(_, let error):
            throw error
        }
    }

    private func toAppStoreResult(_ transaction: Transaction) -> [String: Any] {
        [
            "provider": "APP_STORE",
            "transactionId": String(transaction.id)
        ]
    }
}
