package br.com.fashionai.web.controller.fit;

import br.com.fashionai.application.fit.FitContracts.*;
import br.com.fashionai.application.fit.FitService;
import br.com.fashionai.application.security.CurrentUser;
import java.util.Map;
import java.util.UUID;
import org.springframework.http.HttpStatus;
import org.springframework.http.CacheControl;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

/** Every route uses the existing authenticated default; all personal lookups are scoped to CurrentUser. */
@RestController
public class FitController {
    private final FitService fit;
    public FitController(FitService fit) { this.fit = fit; }
    private <T> ResponseEntity<T> privateResponse(T body) { return ResponseEntity.ok().cacheControl(CacheControl.noStore()).body(body); }
    @GetMapping("/api/fit/config") public Map<String, Object> config(CurrentUser user) { return fit.config(user); }
    @GetMapping("/api/catalog/products/{id}/size-chart")
    public ResponseEntity<ChartView> chart(CurrentUser user, @PathVariable UUID id) { return privateResponse(fit.chart(user, id)); }
    @PutMapping("/api/catalog/products/{id}/size-chart")
    public ChartView chart(CurrentUser user, @PathVariable UUID id, @RequestBody ChartWrite request) { return fit.saveChart(user, id, request); }
    @GetMapping("/api/me/fit-measurements")
    public ResponseEntity<ProfileView> profile(CurrentUser user) {
        var profile = fit.profile(user);
        return profile == null ? ResponseEntity.noContent().cacheControl(CacheControl.noStore()).build() : privateResponse(profile);
    }
    @PutMapping("/api/me/fit-measurements")
    public ResponseEntity<ProfileView> profile(CurrentUser user, @RequestBody ProfileWrite request) { return privateResponse(fit.saveProfile(user, request)); }
    @DeleteMapping("/api/me/fit-measurements") @ResponseStatus(HttpStatus.NO_CONTENT)
    public void deleteProfile(CurrentUser user, @RequestParam long expectedVersion) { fit.deleteProfile(user, expectedVersion); }
    @PostMapping("/api/catalog/products/{id}/size-recommendations")
    public ResponseEntity<RecommendationView> recommend(CurrentUser user, @PathVariable UUID id, @RequestBody Recommend request) { return privateResponse(fit.recommend(user, id, request)); }
    @GetMapping("/api/size-recommendations/{id}")
    public ResponseEntity<RecommendationView> recommendation(CurrentUser user, @PathVariable UUID id) { return privateResponse(fit.recommendation(user, id)); }
    @PostMapping("/api/size-recommendations/{id}/feedback")
    public ResponseEntity<FeedbackView> feedback(CurrentUser user, @PathVariable UUID id, @RequestBody FeedbackWrite request) { return privateResponse(fit.saveFeedback(user, id, request)); }
    @DeleteMapping("/api/fit-feedback/{id}") @ResponseStatus(HttpStatus.NO_CONTENT)
    public void deleteFeedback(CurrentUser user, @PathVariable UUID id) { fit.deleteFeedback(user, id); }
}
