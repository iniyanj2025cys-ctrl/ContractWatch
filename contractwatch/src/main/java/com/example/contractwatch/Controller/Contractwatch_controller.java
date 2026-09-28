package com.example.contractwatch.Controller;

import com.example.contractwatch.Model.ContractStatus;
import com.example.contractwatch.Model.ContractWatch_model;
import com.example.contractwatch.Model.RenewalHistory;
import com.example.contractwatch.Service.Contractwatch_service;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.PositiveOrZero;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.validation.annotation.Validated;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.servlet.support.ServletUriComponentsBuilder;

import java.math.BigDecimal;
import java.net.URI;
import java.time.LocalDate;
import java.util.List;
import java.util.Map;

@Validated
@RestController
@RequestMapping("/api")
@CrossOrigin(origins = "*")
public class Contractwatch_controller {
    private final Contractwatch_service service;
    public Contractwatch_controller(Contractwatch_service service) { this.service = service; }

    @GetMapping("/contracts")
    public List<ContractWatch_model> list(@RequestParam(required = false) String q,
             @RequestParam(required = false) ContractStatus status,
             @RequestParam(required = false, defaultValue = "all") String attention) {
        return service.list(q, status, attention);
    }
    @GetMapping("/contracts/{id}") public ContractWatch_model get(@PathVariable Long id) { return service.get(id); }
    @PostMapping("/contracts")
    public ResponseEntity<ContractWatch_model> create(@Valid @RequestBody ContractWatch_model contract) {
        ContractWatch_model saved = service.create(contract);
        URI location = ServletUriComponentsBuilder.fromCurrentRequest().path("/{id}").buildAndExpand(saved.getId()).toUri();
        return ResponseEntity.created(location).body(saved);
    }
    @PutMapping("/contracts/{id}") public ContractWatch_model update(@PathVariable Long id, @Valid @RequestBody ContractWatch_model contract) { return service.update(id, contract); }
    @DeleteMapping("/contracts/{id}") @ResponseStatus(HttpStatus.NO_CONTENT) public void delete(@PathVariable Long id) { service.delete(id); }
    @PatchMapping("/contracts/{id}/status")
    public ContractWatch_model setStatus(@PathVariable Long id, @RequestBody StatusRequest body) { return service.setStatus(id, body.status()); }
    @PostMapping("/contracts/{id}/renew")
    public ContractWatch_model renew(@PathVariable Long id, @Valid @RequestBody RenewalRequest body) {
        return service.renew(id, body.newEndDate(), body.newAmount(), body.discountPercent());
    }
    @GetMapping("/contracts/{id}/renewals") public List<RenewalHistory> history(@PathVariable Long id) { return service.history(id); }
    @GetMapping("/dashboard/summary") public Map<String, Object> summary() { return service.summary(); }
    @GetMapping("/discounts") public List<ContractWatch_model> discounts() { return service.discounts(); }

    public record StatusRequest(@NotNull ContractStatus status) { }
    public record RenewalRequest(@NotNull @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate newEndDate,
                                 @PositiveOrZero BigDecimal newAmount,
                                 @PositiveOrZero BigDecimal discountPercent) { }
}
