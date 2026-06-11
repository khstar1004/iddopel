package com.iddoppelganger.app;

import android.app.Activity;
import androidx.annotation.NonNull;
import com.android.billingclient.api.BillingClient;
import com.android.billingclient.api.BillingClientStateListener;
import com.android.billingclient.api.BillingFlowParams;
import com.android.billingclient.api.BillingResult;
import com.android.billingclient.api.ConsumeParams;
import com.android.billingclient.api.PendingPurchasesParams;
import com.android.billingclient.api.ProductDetails;
import com.android.billingclient.api.Purchase;
import com.android.billingclient.api.PurchasesUpdatedListener;
import com.android.billingclient.api.QueryProductDetailsParams;
import com.android.billingclient.api.QueryPurchasesParams;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import java.util.Collections;
import java.util.List;

@CapacitorPlugin(name = "NativeBilling")
public class NativeBillingPlugin extends Plugin implements PurchasesUpdatedListener {
    private BillingClient billingClient;
    private PluginCall pendingPurchaseCall;
    private String pendingProductId;

    @Override
    public void load() {
        billingClient = BillingClient.newBuilder(getContext())
            .setListener(this)
            .enablePendingPurchases(
                PendingPurchasesParams.newBuilder()
                    .enableOneTimeProducts()
                    .build()
            )
            .build();
    }

    @PluginMethod
    public void purchaseDetailedReport(PluginCall call) {
        String productId = call.getString("googlePlayProductId", "detailed_report");
        if (productId == null || productId.trim().isEmpty()) {
            call.reject("Google Play 상품 ID를 확인하지 못했어요.");
            return;
        }
        if (pendingPurchaseCall != null) {
            call.reject("이미 진행 중인 결제가 있어요.");
            return;
        }

        ensureBillingReady(call, () -> queryProductAndLaunch(call, productId.trim()));
    }

    @PluginMethod
    public void restoreDetailedReport(PluginCall call) {
        String productId = call.getString("googlePlayProductId", "detailed_report");
        if (productId == null || productId.trim().isEmpty()) {
            call.reject("Google Play 상품 ID를 확인하지 못했어요.");
            return;
        }

        ensureBillingReady(call, () -> billingClient.queryPurchasesAsync(
            QueryPurchasesParams.newBuilder()
                .setProductType(BillingClient.ProductType.INAPP)
                .build(),
            (billingResult, purchases) -> {
                if (!isOk(billingResult)) {
                    rejectBilling(call, "구매 복원을 완료하지 못했어요.", billingResult);
                    return;
                }

                Purchase purchase = findPurchasedProduct(purchases, productId.trim());
                if (purchase == null) {
                    call.reject("복원할 정밀 리포트 구매를 찾지 못했어요.");
                    return;
                }

                call.resolve(toGooglePlayResult(productId.trim(), purchase));
            }
        ));
    }

    @PluginMethod
    public void completeDetailedReportPurchase(PluginCall call) {
        String provider = call.getString("provider", "");
        String purchaseToken = call.getString("purchaseToken", "");

        if (!"GOOGLE_PLAY".equals(provider)) {
            JSObject ret = new JSObject();
            ret.put("ok", true);
            call.resolve(ret);
            return;
        }

        if (purchaseToken == null || purchaseToken.trim().isEmpty()) {
            call.reject("Google Play 구매 토큰을 확인하지 못했어요.");
            return;
        }

        ensureBillingReady(call, () -> {
            ConsumeParams params = ConsumeParams.newBuilder()
                .setPurchaseToken(purchaseToken.trim())
                .build();
            billingClient.consumeAsync(params, (billingResult, consumedToken) -> {
                if (!isOk(billingResult)) {
                    rejectBilling(call, "Google Play 구매 완료 처리를 하지 못했어요.", billingResult);
                    return;
                }

                JSObject ret = new JSObject();
                ret.put("ok", true);
                ret.put("purchaseToken", consumedToken);
                call.resolve(ret);
            });
        });
    }

    @Override
    public void onPurchasesUpdated(@NonNull BillingResult billingResult, List<Purchase> purchases) {
        if (pendingPurchaseCall == null) return;

        PluginCall call = pendingPurchaseCall;
        String productId = pendingProductId;
        pendingPurchaseCall = null;
        pendingProductId = null;

        if (billingResult.getResponseCode() == BillingClient.BillingResponseCode.USER_CANCELED) {
            call.reject("결제가 취소됐어요.");
            return;
        }
        if (!isOk(billingResult) || purchases == null) {
            rejectBilling(call, "Google Play 결제를 완료하지 못했어요.", billingResult);
            return;
        }

        Purchase purchase = findPurchasedProduct(purchases, productId);
        if (purchase == null) {
            call.reject("정밀 리포트 구매 결과를 확인하지 못했어요.");
            return;
        }
        if (purchase.getPurchaseState() == Purchase.PurchaseState.PENDING) {
            call.reject("결제가 아직 대기 중이에요. 결제가 완료되면 구매 복원을 눌러 주세요.");
            return;
        }
        if (purchase.getPurchaseState() != Purchase.PurchaseState.PURCHASED) {
            call.reject("Google Play 구매가 완료되지 않았어요.");
            return;
        }

        call.resolve(toGooglePlayResult(productId, purchase));
    }

    private void queryProductAndLaunch(PluginCall call, String productId) {
        QueryProductDetailsParams.Product product = QueryProductDetailsParams.Product.newBuilder()
            .setProductId(productId)
            .setProductType(BillingClient.ProductType.INAPP)
            .build();

        QueryProductDetailsParams params = QueryProductDetailsParams.newBuilder()
            .setProductList(Collections.singletonList(product))
            .build();

        billingClient.queryProductDetailsAsync(params, (billingResult, result) -> {
            if (!isOk(billingResult)) {
                rejectBilling(call, "Google Play 상품 정보를 불러오지 못했어요.", billingResult);
                return;
            }

            List<ProductDetails> productDetailsList = result.getProductDetailsList();
            if (productDetailsList == null || productDetailsList.isEmpty()) {
                call.reject("Google Play 정밀 리포트 상품을 찾지 못했어요.");
                return;
            }

            ProductDetails productDetails = productDetailsList.get(0);
            BillingFlowParams.ProductDetailsParams.Builder productParams =
                BillingFlowParams.ProductDetailsParams.newBuilder()
                    .setProductDetails(productDetails);
            List<ProductDetails.OneTimePurchaseOfferDetails> offers =
                productDetails.getOneTimePurchaseOfferDetailsList();
            if (offers != null && !offers.isEmpty()) {
                productParams.setOfferToken(offers.get(0).getOfferToken());
            }

            BillingFlowParams flowParams = BillingFlowParams.newBuilder()
                .setProductDetailsParamsList(Collections.singletonList(productParams.build()))
                .build();
            Activity activity = getActivity();
            if (activity == null) {
                call.reject("Google Play 결제를 시작할 화면을 찾지 못했어요.");
                return;
            }

            pendingPurchaseCall = call;
            pendingProductId = productId;
            BillingResult launchResult = billingClient.launchBillingFlow(activity, flowParams);
            if (!isOk(launchResult)) {
                pendingPurchaseCall = null;
                pendingProductId = null;
                rejectBilling(call, "Google Play 결제 화면을 열지 못했어요.", launchResult);
            }
        });
    }

    private void ensureBillingReady(PluginCall call, ReadyCallback callback) {
        if (billingClient == null) load();
        if (billingClient.isReady()) {
            callback.onReady();
            return;
        }

        billingClient.startConnection(new BillingClientStateListener() {
            @Override
            public void onBillingSetupFinished(@NonNull BillingResult billingResult) {
                if (!isOk(billingResult)) {
                    rejectBilling(call, "Google Play 결제 서비스에 연결하지 못했어요.", billingResult);
                    return;
                }
                callback.onReady();
            }

            @Override
            public void onBillingServiceDisconnected() {
            }
        });
    }

    private Purchase findPurchasedProduct(List<Purchase> purchases, String productId) {
        if (purchases == null) return null;
        for (Purchase purchase : purchases) {
            if (purchase.getProducts().contains(productId)) return purchase;
        }
        return null;
    }

    private JSObject toGooglePlayResult(String productId, Purchase purchase) {
        JSObject ret = new JSObject();
        ret.put("provider", "GOOGLE_PLAY");
        ret.put("productId", productId);
        ret.put("purchaseToken", purchase.getPurchaseToken());
        return ret;
    }

    private boolean isOk(BillingResult billingResult) {
        return billingResult.getResponseCode() == BillingClient.BillingResponseCode.OK;
    }

    private void rejectBilling(PluginCall call, String message, BillingResult billingResult) {
        String debugMessage = billingResult.getDebugMessage();
        if (debugMessage == null || debugMessage.trim().isEmpty()) {
            call.reject(message);
        } else {
            call.reject(message + " (" + debugMessage + ")");
        }
    }

    private interface ReadyCallback {
        void onReady();
    }
}
